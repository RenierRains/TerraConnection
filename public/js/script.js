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