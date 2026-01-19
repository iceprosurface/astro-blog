import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Search, X } from 'lucide-react';
import { searchModalState } from './searchState';

interface SearchResponseItem {
  permalink: string;
  title: string;
  titleHtml: string;
  snippetHtml: string;
  tags: string[];
  updatedTs?: number;
}

interface PreviewCache {
  [permalink: string]: string;
}

export default function SearchModal() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(searchModalState.isOpen);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAbortController, setPreviewAbortController] = useState<AbortController | null>(null);
  const [isTagMode, setIsTagMode] = useState(false);

  const previewCache = useRef<PreviewCache>({});

  useEffect(() => {
    const unsubscribe = searchModalState.subscribe((_event, nextIsOpen) => {
      setIsOpen(nextIsOpen);

      if (nextIsOpen) {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
    });

    if (searchModalState.isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }

    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => {
            if (results.length === 0) return -1;
            return prev < results.length - 1 ? prev + 1 : prev;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => {
            if (results.length === 0) return -1;
            return prev > 0 ? prev - 1 : 0;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            handleResultClick(results[selectedIndex]);
          } else if (results.length > 0) {
            handleResultClick(results[0]);
          }
          break;
        case 'Tab':
          // Allow tab navigation
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      setPreviewContent('');
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timeoutId = setTimeout(() => {
      const mode = isTagMode ? 'tags' : 'basic';
      fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8&mode=${mode}`, {
        signal: controller.signal,
      })
        .then(response => {
          if (!response.ok) throw new Error('Search failed');
          return response.json();
        })
        .then(data => {
          setResults(data.items || []);
          setSelectedIndex(-1);
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            console.error('Search error:', error);
            setResults([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, isTagMode]);

  useEffect(() => {
    return () => {
      previewAbortController?.abort();
    };
  }, [previewAbortController]);

  useEffect(() => {
    if (!isOpen) return;

    if (selectedIndex < 0 || selectedIndex >= results.length) {
      setPreviewContent('');
      return;
    }

    void handleResultHover(results[selectedIndex]);
  }, [isOpen, results, selectedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    setIsTagMode(value.startsWith('#'));
  };

  const handleResultClick = async (result: SearchResponseItem) => {
    window.location.href = result.permalink;
  };

  const handleResultHover = async (result: SearchResponseItem) => {
    previewAbortController?.abort();

    const normalizedPermalink = result.permalink.startsWith('/')
      ? result.permalink
      : `/${result.permalink}`;
    const previewUrl = `/preview${normalizedPermalink.replace(/\/$/, '')}`;

    if (previewCache.current[previewUrl]) {
      setPreviewContent(previewCache.current[previewUrl]);
      return;
    }

    setPreviewLoading(true);
    const controller = new AbortController();
    setPreviewAbortController(controller);

    try {
      const response = await fetch(previewUrl, {
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Failed to fetch preview');

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const previewElement = doc.querySelector('[data-search-preview]');
      if (previewElement) {
        const cleanElement = previewElement.cloneNode(true) as Element;
        const scriptTags = cleanElement.querySelectorAll('script');
        scriptTags.forEach(script => script.remove());

        const content = cleanElement.innerHTML;
        previewCache.current[previewUrl] = content;

        const highlightedContent = highlightTerms(content, query);
        setPreviewContent(highlightedContent);
      } else {
        setPreviewContent('');
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Preview fetch error:', error);
        setPreviewContent('');
      }
    } finally {
      setPreviewLoading(false);
      setPreviewAbortController(null);
    }
  };

  const highlightTerms = (html: string, term: string): string => {
    if (!term.trim()) return html;

    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'gi');

    return html.replace(regex, '<mark class="search-highlight">$&</mark>');
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="search-modal active" onClick={(e) => e.target === e.currentTarget && searchModalState.close()}>
      <div className="modal-content">
        <div className="search-bar-header">
          <div className="search-icon-wrapper">
            <Search className="search-icon w-5 h-5" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder={isTagMode ? "搜索标签..." : "输入关键词搜索..."}
            className="search-input"
          />
          <div className="header-actions">
            {isTagMode && (
              <span className="tag-mode-indicator"># 标签</span>
            )}
            <button className="modal-close-btn" onClick={() => searchModalState.close()}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="search-content">
          <div className="search-results" ref={resultsRef}>
            {loading ? (
              <div className="search-loading">搜索中...</div>
            ) : results.length === 0 ? (
              <div className="search-empty">
                {query.trim() ? '未找到相关内容' : '输入关键词开始搜索'}
              </div>
            ) : (
              <div className="results-list">
                {results.map((result, index) => (
                  <div
                    key={result.permalink}
                    className={`result-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => handleResultClick(result)}
                    onMouseEnter={() => handleResultHover(result)}
                    onMouseDown={(e) => e.preventDefault()}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleResultClick(result);
                      }
                    }}
                  >
                    <div className="result-title" dangerouslySetInnerHTML={{ __html: result.titleHtml }} />
                    <div className="result-snippet" dangerouslySetInnerHTML={{ __html: result.snippetHtml }} />
                    {result.tags.length > 0 && (
                      <div className="result-tags">
                        {result.tags.map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="search-preview" ref={previewRef}>
            {previewLoading ? (
              <div className="preview-loading">加载预览...</div>
            ) : previewContent ? (
              <div className="preview-content" dangerouslySetInnerHTML={{ __html: previewContent }} />
            ) : (
              <div className="preview-empty">
                选择结果项查看预览
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}