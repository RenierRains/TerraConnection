const modalHandler = (req, res, next) => {
  const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';
  
  if (isAjax) {
    res.locals.layout = false;
    
    const originalRender = res.render;
    
    res.render = function(view, options = {}) {
      const originalCallback = options.callback;
      options.callback = function(err, html) {
        if (err) return originalCallback ? originalCallback(err) : next(err);
        
        const contentMatch = html.match(/<div class="container[^>]*>([\s\S]*?)<\/div>/);
        const content = contentMatch ? contentMatch[1] : html;
        
        if (originalCallback) {
          originalCallback(null, content);
        } else {
          res.send(content);
        }
      };
      
      originalRender.call(this, view, { ...options, layout: false });
    };
  }
  
  next();
};

module.exports = modalHandler; 