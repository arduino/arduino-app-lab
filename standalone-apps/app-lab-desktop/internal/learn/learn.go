package learn

import (
	"context"
	"fmt"
	"io/fs"
	"path"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/adrg/frontmatter"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const assetsDir = "assets"

var resourcesRe = regexp.MustCompile(`^(\d+)\.(.+)$`)

type LearnResourceID string

type Tag struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

type LearnResourceEntry struct {
	ID           LearnResourceID `json:"id"`
	Path         string          `json:"-"`
	Title        string          `json:"title"`
	Description  string          `json:"description"`
	Tags         []Tag           `json:"tags"`
	Icon         string          `json:"icon"`
	Category     string          `json:"category"`
	LastRevision *time.Time      `json:"lastRevision"`
}

type FullLearnResource struct {
	LearnResourceEntry
	Resource string `json:"content"`
}

type Learn struct {
	once        sync.Once
	lazyInitErr error
	store       map[LearnResourceID]LearnResourceEntry
}

func New() *Learn {
	return &Learn{
		store: make(map[LearnResourceID]LearnResourceEntry),
	}
}

func (l *Learn) findResourcesPaths(ctx context.Context) ([]string, error) {
	entries, err := learnFS.ReadDir(assetsDir)
	if err != nil {
		return nil, err
	}

	var results []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		match := resourcesRe.FindStringSubmatch(name)
		if match == nil {
			continue
		}
		dirNamePart := match[2]
		expectedMD := path.Join(assetsDir, name, dirNamePart+".md")
		info, err := fs.Stat(learnFS, expectedMD)
		if err != nil || info.IsDir() {
			runtime.LogWarning(ctx, fmt.Sprintf("Expected markdown file \"%s\" not found in directory \"%s\"", expectedMD, name))
			continue
		}

		results = append(results, expectedMD)
	}
	return results, nil
}

func (l *Learn) addLastRevision(path string) (*time.Time, error) {
	b, err := fs.ReadFile(learnFS, path+".lastmod")
	if err != nil {
		return nil, fmt.Errorf("failed to read lastmod file: %w", err)
	}

	lastRevision, err := time.Parse("2006-01-02", strings.TrimSpace(string(b)))
	if err != nil {
		return nil, fmt.Errorf("failed to parse last revision date: %w", err)
	}

	return &lastRevision, nil
}

type learnResourceFrontMatter struct {
	Title       string   `yaml:"title"`
	Description string   `yaml:"description"`
	Tags        []string `yaml:"tags"`
	Icon        string   `yaml:"icon"`
	Category    string   `yaml:"category"`
}

func (l *Learn) lazyInit(ctx context.Context) error {
	l.once.Do(func() {
		contentPaths, err := l.findResourcesPaths(ctx)
		if err != nil {
			l.lazyInitErr = fmt.Errorf("failed to find learn content paths: %w", err)
			return
		}

		tmp := make(map[LearnResourceID]LearnResourceEntry, len(contentPaths))

		for _, p := range contentPaths {
			name := strings.TrimSuffix(path.Base(p), path.Ext(p))
			f, err := learnFS.Open(p)
			if err != nil {
				runtime.LogWarning(ctx, fmt.Sprintf("Failed to open learn content file \"%s\": %v", p, err))
				continue
			}
			defer f.Close()

			var frontMatter learnResourceFrontMatter
			_, err = frontmatter.Parse(f, &frontMatter)
			if err != nil {
				runtime.LogWarning(ctx, fmt.Sprintf("Failed to parse learn content front matter in file \"%s\": %v", p, err))
				continue
			}

			var tags []Tag
			for _, t := range frontMatter.Tags {
				trimmed := strings.TrimSpace(t)
				normalized := strings.ReplaceAll(strings.ToLower(trimmed), " ", "-")
				normalized = strings.ReplaceAll(normalized, "_", "-")
				if normalized != "" {
					tags = append(tags, Tag{ID: normalized, Label: trimmed})
				}
			}

			lastRevision, err := l.addLastRevision(p)
			if err != nil {
				runtime.LogWarning(ctx, fmt.Sprintf("Failed to get last revision for learn content file \"%s\": %v", p, err))
			}

			id := LearnResourceID(name)
			tmp[id] = LearnResourceEntry{
				ID:           id,
				Path:         p,
				Title:        frontMatter.Title,
				Description:  frontMatter.Description,
				Tags:         tags,
				Icon:         frontMatter.Icon,
				Category:     frontMatter.Category,
				LastRevision: lastRevision,
			}
		}

		l.store = tmp
	})

	return l.lazyInitErr
}

func (l *Learn) GetResourceList(ctx context.Context) ([]LearnResourceEntry, error) {
	if err := l.lazyInit(ctx); err != nil {
		return nil, err
	}

	contentList := make([]LearnResourceEntry, len(l.store))
	i := 0
	for _, lr := range l.store {
		contentList[i] = lr
		i++
	}
	sort.Slice(contentList, func(i, j int) bool {
		return contentList[i].Path < contentList[j].Path
	})
	return contentList, nil
}

func (l *Learn) GetResource(ctx context.Context, id LearnResourceID) (*FullLearnResource, error) {
	if err := l.lazyInit(ctx); err != nil {
		return nil, err
	}

	if i := strings.Index(string(id), "#"); i != -1 { // strip anchor if any
		id = id[:i]
	}

	lr, ok := l.store[id]
	if !ok {
		return nil, fmt.Errorf("learn content with id %q not found", id)
	}

	f, err := learnFS.Open(lr.Path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var fm learnResourceFrontMatter
	content, err := frontmatter.Parse(f, &fm)
	if err != nil {
		return nil, fmt.Errorf("failed to parse learn content stripping front matter: %w", err)
	}

	return &FullLearnResource{
		LearnResourceEntry: lr,
		Resource:           string(content),
	}, nil
}

func (l *Learn) GetTags(ctx context.Context) ([]Tag, error) {
	if err := l.lazyInit(ctx); err != nil {
		return nil, err
	}

	tagMap := make(map[string]Tag)
	for _, lr := range l.store {
		for _, t := range lr.Tags {
			tagMap[t.ID] = t
		}
	}

	tags := make([]Tag, 0, len(tagMap))
	for _, t := range tagMap {
		tags = append(tags, t)
	}
	sort.Slice(tags, func(i, j int) bool {
		return tags[i].Label < tags[j].Label
	})
	return tags, nil
}
