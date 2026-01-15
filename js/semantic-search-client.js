/**
 * SemanticSearch Frontend Client
 * Customized to support { document: { metadata } } response shape.
 */
(function(window) {
  'use strict';

  var config = window.SEMANTIC_SEARCH_CONFIG || {};

  var SemanticSearch = {
    endpoint: config.endpoint,
    readerKey: config.readerKey,

    /**
     * Configure the client
     */
    configure: function(options) {
      this.endpoint = options.endpoint || this.endpoint;
      this.readerKey = options.readerKey || this.readerKey;
    },

    /**
     * Search documents
     */
    search: function(query, options) {
      var self = this;
      options = options || {};

      return new Promise(function(resolve, reject) {
        if (!self.endpoint) {
          reject(new Error('SemanticSearch endpoint not configured'));
          return;
        }

        var xhr = new XMLHttpRequest();
        xhr.open('POST', self.endpoint + '/v1/search', true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        if (self.readerKey) {
          xhr.setRequestHeader('Authorization', 'Bearer ' + self.readerKey);
        }

        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                var response = JSON.parse(xhr.responseText);
                resolve(response.results || response || []);
              } catch (e) {
                reject(new Error('Failed to parse response'));
              }
            } else {
              reject(new Error('Search failed: ' + xhr.status));
            }
          }
        };

        xhr.onerror = function() {
          reject(new Error('Network error'));
        };

        xhr.send(JSON.stringify({
          query: query,
          limit: options.limit || 10
        }));
      });
    },

    /**
     * Update URL with search query parameter
     */
    _updateUrl: function(query) {
      var url = new URL(window.location.href);
      if (query) {
        url.searchParams.set('q', query);
      } else {
        url.searchParams.delete('q');
      }
      window.history.replaceState({}, '', url.toString());
    },

    /**
     * Get search query from URL parameter
     */
    _getQueryFromUrl: function() {
      var url = new URL(window.location.href);
      return url.searchParams.get('q') || '';
    },

    /**
     * Bind search box with auto-complete
     */
    bindSearchBox: function(inputSelector, resultSelector, options) {
      var self = this;
      options = options || {};

      var input = typeof inputSelector === 'string'
        ? document.querySelector(inputSelector)
        : inputSelector;
      var resultContainer = typeof resultSelector === 'string'
        ? document.querySelector(resultSelector)
        : resultSelector;

      if (!input || !resultContainer) {
        console.warn('SemanticSearch: Input or result container not found');
        return;
      }

      var debounceTimer;
      var minLength = options.minLength || 2;
      var debounceMs = options.debounce || 300;

      // Perform search and update URL
      var doSearch = function(query, updateHistory) {
        if (updateHistory) {
          self._updateUrl(query);
        }
        self.search(query, { limit: options.limit || 10 })
          .then(function(results) {
            self._renderResults(resultContainer, results, options);
          })
          .catch(function(error) {
            console.error('SemanticSearch error:', error);
            resultContainer.innerHTML = '<div class="semantic-search-error">Search failed</div>';
            resultContainer.style.display = 'block';
          });
      };

      input.addEventListener('input', function() {
        var query = input.value.trim();

        clearTimeout(debounceTimer);

        if (query.length < minLength) {
          resultContainer.innerHTML = '';
          resultContainer.style.display = 'none';
          return;
        }

        debounceTimer = setTimeout(function() {
          doSearch(query, false);
        }, debounceMs);
      });

      // Update URL on Enter key
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var query = input.value.trim();
          if (query.length >= minLength) {
            clearTimeout(debounceTimer);
            doSearch(query, true);
          }
        }
      });

      // Load query from URL on init
      var urlQuery = self._getQueryFromUrl();
      if (urlQuery) {
        input.value = urlQuery;
        if (urlQuery.length >= minLength) {
          doSearch(urlQuery, false);
        }
      }

      // Hide results on click outside
      document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !resultContainer.contains(e.target)) {
          resultContainer.style.display = 'none';
        }
      });
    },

    /**
     * Normalize response shapes
     */
    _normalizeResult: function(item) {
      var doc = item && item.document ? item.document : item;
      var metadata = (doc && doc.metadata) ? doc.metadata : (item && item.metadata ? item.metadata : {});
      var title = (metadata && metadata.title) || (doc && doc.title) || (item && item.title) || 'Untitled';
      var url = (metadata && metadata.url) || (doc && doc.url) || (item && item.url) || '#';
      var excerpt = (metadata && metadata.excerpt) || (doc && doc.excerpt) || (item && item.excerpt) || '';

      return {
        title: title,
        url: url,
        excerpt: excerpt
      };
    },

    /**
     * Render search results
     */
    _renderResults: function(container, results, options) {
      if (!results || results.length === 0) {
        container.innerHTML = '<div class="semantic-search-no-results">' +
          (options.noResultsText || 'No results found') + '</div>';
        container.style.display = 'block';
        return;
      }

      var html = '<ul class="semantic-search-result-list">';
      for (var i = 0; i < results.length; i++) {
        var normalized = this._normalizeResult(results[i]);

        html += '<li class="semantic-search-result-item">';
        html += '<a href="' + normalized.url + '" class="semantic-search-result-link">' + normalized.title + '</a>';
        if (normalized.excerpt && options.showExcerpt !== false) {
          var shortExcerpt = normalized.excerpt.substring(0, 100) + (normalized.excerpt.length > 100 ? '...' : '');
          html += '<p class="semantic-search-result-excerpt">' + shortExcerpt + '</p>';
        }
        html += '</li>';
      }
      html += '</ul>';

      container.innerHTML = html;
      container.style.display = 'block';
    }
  };

  // Auto-init if config exists
  if (config.endpoint) {
    document.addEventListener('DOMContentLoaded', function() {
      var searchBox = document.querySelector('.semantic-search-box');
      if (searchBox) {
        var input = searchBox.querySelector('.semantic-search-input');
        var results = searchBox.querySelector('.semantic-search-results');
        if (input && results) {
          SemanticSearch.bindSearchBox(input, results);
        }
      }
    });
  }

  window.SemanticSearch = SemanticSearch;

})(window);
