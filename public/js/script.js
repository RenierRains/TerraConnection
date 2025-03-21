let lastScrollTop = 0;
const header = document.querySelector('.admin-panel header');
const scrollThreshold = 100;

// Only add scroll event listener if header exists
if (header) {
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (Math.abs(lastScrollTop - scrollTop) <= scrollThreshold) return;
    
    if (scrollTop > lastScrollTop && scrollTop > header.offsetHeight) {
      header.classList.add('scroll-down');
      header.classList.remove('scroll-up');
    } else {
      header.classList.remove('scroll-down');
      header.classList.add('scroll-up');
    }
    
    lastScrollTop = scrollTop;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    
    if (currentPath === href || 
        (href !== '/admin/dashboard' && currentPath.startsWith(href))) {
      link.classList.add('active');
      
      link.style.animation = 'highlightItem 0.3s ease forwards';
    }
  });
});

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('globalSearch');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    async function performSearch(query) {
        try {
            const response = await fetch(`/admin/global-search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.results.length > 0) {
                displayResults(data.results);
            } else {
                searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
            }
            searchResults.style.display = 'block';
        } catch (err) {
            console.error('Search error:', err);
        }
    }

    function displayResults(results) {
        searchResults.innerHTML = results.map(result => `
            <div class="search-result-item" data-url="${result.url}" data-modal="true">
                <span class="result-type">${result.type}</span>
                <span>${result.title}</span>
            </div>
        `).join('');

        // Add click handlers for search results
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const url = this.dataset.url;
                const modal = $('#appModal');
                const bsModal = new bootstrap.Modal(modal[0]);
                
                modal.find('.modal-title').text('Loading...');
                bsModal.show();
                
                $.ajax({
                    url: url,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    success: function(response) {
                        const cleanResponse = response.trim();
                        modal.find('.modal-body').html(cleanResponse);
                        
                        const title = $(cleanResponse).find('h2').first().text().trim() || 'Details';
                        modal.find('.modal-title').text(title);
                        
                        // Hide search results after selecting an item
                        searchResults.style.display = 'none';
                    },
                    error: function(xhr) {
                        modal.find('.modal-body').html('<div class="alert alert-danger">Error loading content. Please try again.</div>');
                        modal.find('.modal-title').text('Error');
                    }
                });
            });
        });
    }
});