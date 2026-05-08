package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// POST /api/upload
// Upload file (logo, video, dll)
func uploadFile(c *gin.Context) {
	// Get file from form data
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Validate file size (max 50MB)
	maxSize := int64(50 * 1024 * 1024) // 50MB
	if file.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large. Max 50MB"})
		return
	}

	// Get file extension
	ext := strings.ToLower(filepath.Ext(file.Filename))

	// Validate file type
	allowedExts := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".svg":  true,
		".webp": true,
		".mp4":  true,
		".webm": true,
		".avi":  true,
		".mov":  true,
	}

	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid file type. Allowed: jpg, jpeg, png, gif, svg, webp, mp4, webm, avi, mov",
		})
		return
	}

	// Create uploads directory if not exists
	uploadsDir := "./uploads"
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create uploads directory"})
		return
	}

	// Generate unique filename with timestamp
	timestamp := time.Now().Unix()
	baseFilename := strings.TrimSuffix(file.Filename, ext)
	// Clean filename - remove special characters
	baseFilename = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			return r
		}
		return '_'
	}, baseFilename)

	newFilename := fmt.Sprintf("%s_%d%s", baseFilename, timestamp, ext)
	filepath := filepath.Join(uploadsDir, newFilename)

	// Save file
	if err := c.SaveUploadedFile(file, filepath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Return file URL
	fileURL := fmt.Sprintf("/uploads/%s", newFilename)

	c.JSON(http.StatusOK, gin.H{
		"message":  "File uploaded successfully",
		"url":      fileURL,
		"filename": newFilename,
		"size":     file.Size,
	})
}

// DELETE /api/upload/:filename
// Delete uploaded file
func deleteUploadedFile(c *gin.Context) {
	filename := c.Param("filename")

	// Validate filename - prevent directory traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid filename"})
		return
	}

	filepath := filepath.Join("./uploads", filename)

	// Check if file exists
	if _, err := os.Stat(filepath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Delete file
	if err := os.Remove(filepath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "File deleted successfully",
	})
}
