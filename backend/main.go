package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"encoding/json"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// --- Models ---
type User struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Username     string `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash string `gorm:"not null" json:"-"`
	Settings     Settings
}

type Settings struct {
	ID               uint   `gorm:"primaryKey" json:"id"`
	UserID           uint   `gorm:"uniqueIndex" json:"userId"`
	HaUrl            string `gorm:"default:''" json:"haUrl"`
	HaToken          string `gorm:"default:''" json:"haToken"`
	HaDeviceId       string `gorm:"default:''" json:"haDeviceId"`
	TrackingInterval int    `gorm:"default:15" json:"trackingInterval"`
}

type TrackingSession struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	UserID    uint       `json:"userId"`
	StartTime time.Time  `json:"startTime"`
	EndTime   *time.Time `json:"endTime"`
	Locations []Location `gorm:"foreignKey:TrackingSessionID" json:"locations"`
}

type Location struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	TrackingSessionID uint      `json:"trackingSessionId"`
	Latitude          float64   `json:"latitude"`
	Longitude         float64   `json:"longitude"`
	Timestamp         time.Time `json:"timestamp"`
}

// --- Tracking State ---
type TrackerState struct {
	CancelFunc        context.CancelFunc
	LastKnownLocation *map[string]float64
	Settings          Settings
	CurrentSession    TrackingSession
}

var (
	db             *gorm.DB
	activeTrackers = make(map[uint]*TrackerState)
	trackersMu     sync.RWMutex
	jwtSecret      []byte
)

// --- Utils ---
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func detectAppEnv() string {
	if env, ok := os.LookupEnv("APP_ENV"); ok && strings.TrimSpace(env) != "" {
		return strings.TrimSpace(env)
	}
	if env, ok := os.LookupEnv("ENVIRONMENT"); ok && strings.TrimSpace(env) != "" {
		return strings.TrimSpace(env)
	}
	return "development"
}

func parseEnvLine(line string) (string, string, bool) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasPrefix(trimmed, "#") {
		return "", "", false
	}

	trimmed = strings.TrimPrefix(trimmed, "export ")
	parts := strings.SplitN(trimmed, "=", 2)
	if len(parts) != 2 {
		return "", "", false
	}

	key := strings.TrimSpace(parts[0])
	if key == "" {
		return "", "", false
	}

	value := strings.TrimSpace(parts[1])
	if len(value) >= 2 {
		if (value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'') {
			value = value[1 : len(value)-1]
		}
	}

	return key, value, true
}

func loadEnvFile(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		key, value, ok := parseEnvLine(scanner.Text())
		if !ok {
			continue
		}
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, value)
		}
	}

	return scanner.Err()
}

func loadExampleEnvFiles(appEnv string) {
	roots := []string{".", ".."}
	files := []string{
		".env.example",
		fmt.Sprintf(".env.%s.example", appEnv),
	}
	loaded := map[string]struct{}{}

	for _, root := range roots {
		for _, file := range files {
			path := filepath.Join(root, file)
			if _, seen := loaded[path]; seen {
				continue
			}
			if err := loadEnvFile(path); err == nil {
				loaded[path] = struct{}{}
				log.Printf("Loaded environment defaults from %s", path)
			}
		}
	}
}

func registrationEnabled() bool {
	return strings.EqualFold(strings.TrimSpace(getEnv("ALLOW_REGISTRATION", "false")), "true")
}

// --- Auth Middleware ---
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Authorization header required"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid auth header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusForbidden, gin.H{"message": "Invalid or expired token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"message": "Invalid claims"})
			c.Abort()
			return
		}

		c.Set("userId", uint(claims["id"].(float64)))
		c.Set("username", claims["username"].(string))
		c.Next()
	}
}

// --- Tracking Logic ---
func fetchAndSaveLocation(ctx context.Context, userID uint) {
	trackersMu.RLock()
	tracker, ok := activeTrackers[userID]
	trackersMu.RUnlock()
	if !ok {
		return
	}

	settings := tracker.Settings
	if settings.HaUrl == "" || settings.HaToken == "" || settings.HaDeviceId == "" {
		return
	}

	baseUrl := settings.HaUrl
	if !strings.HasSuffix(baseUrl, "/") {
		baseUrl += "/"
	}
	apiUrl := fmt.Sprintf("%sapi/states/%s", baseUrl, settings.HaDeviceId)

	client := &http.Client{Timeout: 10 * time.Second}
	req, _ := http.NewRequestWithContext(ctx, "GET", apiUrl, nil)
	req.Header.Set("Authorization", "Bearer "+settings.HaToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[User %d] HA API Error: %v", userID, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		var result struct {
			Attributes struct {
				Latitude  float64 `json:"latitude"`
				Longitude float64 `json:"longitude"`
			} `json:"attributes"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
			lat := result.Attributes.Latitude
			lng := result.Attributes.Longitude

			trackersMu.Lock()
			tracker.LastKnownLocation = &map[string]float64{"latitude": lat, "longitude": lng}
			trackersMu.Unlock()

			location := Location{
				TrackingSessionID: tracker.CurrentSession.ID,
				Latitude:          lat,
				Longitude:         lng,
				Timestamp:         time.Now(),
			}
			db.Create(&location)
		}
	}
}

func startTrackingWorker(userID uint, settings Settings, session TrackingSession) {
	ctx, cancel := context.WithCancel(context.Background())

	trackersMu.Lock()
	activeTrackers[userID] = &TrackerState{
		CancelFunc:     cancel,
		Settings:       settings,
		CurrentSession: session,
	}
	trackersMu.Unlock()

	go func() {
		ticker := time.NewTicker(time.Duration(settings.TrackingInterval) * time.Second)
		defer ticker.Stop()

		fetchAndSaveLocation(ctx, userID)

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				fetchAndSaveLocation(ctx, userID)
			}
		}
	}()
}

func stopTrackingWorker(userID uint) {
	trackersMu.Lock()
	defer trackersMu.Unlock()
	if tracker, ok := activeTrackers[userID]; ok {
		tracker.CancelFunc()
		delete(activeTrackers, userID)
	}
}

// --- Main ---
func main() {
	appEnv := detectAppEnv()
	loadExampleEnvFiles(appEnv)
	jwtSecret = []byte(getEnv("JWT_SECRET", "super_secret_jwt_key_ha_tracker"))

	// Database
	var err error
	dbPath := filepath.Join(".", "database.sqlite")
	db, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect database:", err)
	}

	// Enable Foreign Keys for SQLite
	db.Exec("PRAGMA foreign_keys = ON")

	db.AutoMigrate(&User{}, &Settings{}, &TrackingSession{}, &Location{})

	// Resume sessions
	var unfinishedSessions []TrackingSession
	db.Where("end_time IS NULL").Find(&unfinishedSessions)
	for _, session := range unfinishedSessions {
		var settings Settings
		db.Where("user_id = ?", session.UserID).First(&settings)
		if settings.ID != 0 {
			startTrackingWorker(session.UserID, settings, session)
		}
	}

	r := gin.Default()

	// Permissive CORS for development
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	hat := r.Group("/hat")
	{
		// Auth
		hat.POST("/auth/register", func(c *gin.Context) {
			if !registrationEnabled() {
				c.JSON(http.StatusForbidden, gin.H{"message": "Registration of new admins is disabled."})
				return
			}

			var input struct {
				Username string `json:"username" binding:"required"`
				Password string `json:"password" binding:"required"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(400, gin.H{"message": err.Error()})
				return
			}

			hash, _ := bcrypt.GenerateFromPassword([]byte(input.Password), 10)
			user := User{Username: input.Username, PasswordHash: string(hash)}
			if err := db.Create(&user).Error; err != nil {
				c.JSON(400, gin.H{"message": "Username already taken"})
				return
			}

			db.Create(&Settings{UserID: user.ID})

			token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
				"id":       user.ID,
				"username": user.Username,
				"exp":      time.Now().Add(time.Hour * 24 * 7).Unix(),
			})
			tokenString, _ := token.SignedString(jwtSecret)

			c.JSON(201, gin.H{"token": tokenString, "user": gin.H{"id": user.ID, "username": user.Username}})
		})

		hat.POST("/auth/login", func(c *gin.Context) {
			var input struct {
				Username string `json:"username" binding:"required"`
				Password string `json:"password" binding:"required"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(400, gin.H{"message": err.Error()})
				return
			}

			var user User
			if err := db.Where("username = ?", input.Username).First(&user).Error; err != nil {
				c.JSON(400, gin.H{"message": "Invalid credentials"})
				return
			}

			if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
				c.JSON(400, gin.H{"message": "Invalid credentials"})
				return
			}

			token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
				"id":       user.ID,
				"username": user.Username,
				"exp":      time.Now().Add(time.Hour * 24 * 7).Unix(),
			})
			tokenString, _ := token.SignedString(jwtSecret)

			c.JSON(200, gin.H{"token": tokenString, "user": gin.H{"id": user.ID, "username": user.Username}})
		})

		hat.GET("/auth/me", AuthMiddleware(), func(c *gin.Context) {
			userID := c.GetUint("userId")
			var user User
			if err := db.First(&user, userID).Error; err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "User no longer exists"})
				return
			}
			c.JSON(200, gin.H{"user": gin.H{"id": user.ID, "username": user.Username}})
		})

		// API (Protected)
		api := hat.Group("/api")
		api.Use(AuthMiddleware())
		{
			api.GET("/settings", func(c *gin.Context) {
				var settings Settings
				userID := c.GetUint("userId")
				if err := db.Where("user_id = ?", userID).First(&settings).Error; err != nil {
					// Create default settings if not found
					settings = Settings{UserID: userID}
					db.Create(&settings)
				}
				c.JSON(200, settings)
			})

			api.POST("/settings", func(c *gin.Context) {
				var settings Settings
				userID := c.GetUint("userId")

				// Fetch current to ensure we update the right one
				db.Where("user_id = ?", userID).First(&settings)

				if err := c.ShouldBindJSON(&settings); err != nil {
					c.JSON(400, gin.H{"message": err.Error()})
					return
				}
				settings.UserID = userID // Ensure it stays linked to current user

				log.Printf("[User %d] Salvando configurações: HA_URL=%s", userID, settings.HaUrl)

				if err := db.Save(&settings).Error; err != nil {
					c.JSON(500, gin.H{"message": "Erro ao salvar: " + err.Error()})
					return
				}

				trackersMu.RLock()
				tracker, active := activeTrackers[userID]
				trackersMu.RUnlock()
				if active {
					log.Printf("[User %d] Reiniciando rastreador com novas configurações", userID)
					stopTrackingWorker(userID)
					startTrackingWorker(userID, settings, tracker.CurrentSession)
				}
				c.JSON(200, settings)
			})

			api.POST("/tracking/start", func(c *gin.Context) {
				userID := c.GetUint("userId")
				trackersMu.RLock()
				_, active := activeTrackers[userID]
				trackersMu.RUnlock()
				if active {
					c.JSON(400, gin.H{"message": "Tracking already active"})
					return
				}

				var settings Settings
				db.Where("user_id = ?", userID).First(&settings)

				session := TrackingSession{UserID: userID, StartTime: time.Now()}
				db.Create(&session)

				startTrackingWorker(userID, settings, session)
				c.JSON(200, gin.H{"message": "Started", "sessionId": session.ID})
			})

			api.POST("/tracking/stop", func(c *gin.Context) {
				userID := c.GetUint("userId")
				trackersMu.RLock()
				tracker, active := activeTrackers[userID]
				trackersMu.RUnlock()
				if !active {
					c.JSON(400, gin.H{"message": "Tracking not active"})
					return
				}

				now := time.Now()
				db.Model(&tracker.CurrentSession).Update("EndTime", &now)
				stopTrackingWorker(userID)
				c.JSON(200, gin.H{"message": "Stopped"})
			})

			api.GET("/location", func(c *gin.Context) {
				trackersMu.RLock()
				defer trackersMu.RUnlock()
				if tracker, ok := activeTrackers[c.GetUint("userId")]; ok {
					c.JSON(200, tracker.LastKnownLocation)
					return
				}
				c.JSON(200, nil)
			})

			api.GET("/tracking/histories", func(c *gin.Context) {
				var sessions []TrackingSession
				db.Where("user_id = ?", c.GetUint("userId")).Preload("Locations").Order("start_time desc").Find(&sessions)
				c.JSON(200, sessions)
			})

			api.GET("/tracking/current", func(c *gin.Context) {
				trackersMu.RLock()
				tracker, ok := activeTrackers[c.GetUint("userId")]
				trackersMu.RUnlock()
				if !ok {
					c.JSON(200, nil)
					return
				}
				var session TrackingSession
				db.Preload("Locations").First(&session, tracker.CurrentSession.ID)
				c.JSON(200, session)
			})

			api.DELETE("/tracking/histories", func(c *gin.Context) {
				db.Where("user_id = ?", c.GetUint("userId")).Delete(&TrackingSession{})
				c.JSON(200, gin.H{"message": "Cleared"})
			})
		}
	}

	port := getEnv("PORT", "3001")
	log.Printf("Iniciando servidor na porta %s (http://0.0.0.0:%s)...", port, port)
	r.Run("0.0.0.0:" + port)
}
