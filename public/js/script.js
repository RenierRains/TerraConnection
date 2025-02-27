let lastScrollTop = 0;
const header = document.querySelector('.admin-panel header');
const scrollThreshold = 100;

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
            <div class="search-result-item" onclick="window.location.href='${result.url}'">
                <span class="result-type">${result.type}</span>
                <span>${result.title}</span>
            </div>
        `).join('');
    }
});