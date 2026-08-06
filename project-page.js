// Import projects from script.js
// Note: Since script.js uses 'const projects', we need to make sure it's accessible
// We'll load the project data from the query parameter

const getUrlParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get('id'),
    category: params.get('category'),
    variant: params.get('variant')
  };
};

const findProject = (projectId) => {
  // Access projects array from script.js
  if (typeof window.projects === 'undefined') {
    console.error('Projects array not found');
    return null;
  }
  return window.projects.find(p => p.id === projectId);
};

const getProjectsByCategory = (category) => {
  if (typeof window.projects === 'undefined') {
    return [];
  }
  return window.projects.filter(p => p.category === category);
};

const getNavigationProjects = (currentProject) => {
  const categoryProjects = getProjectsByCategory(currentProject.category);
  const currentIndex = categoryProjects.findIndex(p => p.id === currentProject.id);
  
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : categoryProjects.length - 1;
  const nextIndex = currentIndex < categoryProjects.length - 1 ? currentIndex + 1 : 0;
  
  return {
    prev: categoryProjects[prevIndex],
    next: categoryProjects[nextIndex]
  };
};

const renderProjectMedia = (mediaContainer, { mediaType, mediaSrc, thumbnail, title }) => {
  mediaContainer.innerHTML = '';

  if (mediaType === 'video') {
    const video = document.createElement('video');
    video.src = mediaSrc;
    video.controls = true;
    video.controlsList = 'nodownload';
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.className = 'detail-media detail-media-video';
    if (thumbnail) video.poster = thumbnail;
    video.oncontextmenu = () => false;
    mediaContainer.appendChild(video);
  } else if (mediaType === 'iframe') {
    const iframe = document.createElement('iframe');
    iframe.src = mediaSrc;
    iframe.setAttribute('title', `${title} preview`);
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    iframe.className = 'detail-media detail-media-iframe';
    mediaContainer.appendChild(iframe);
  } else {
    const img = document.createElement('img');
    img.src = mediaSrc || thumbnail;
    img.alt = title;
    img.className = 'detail-media detail-media-image';
    img.oncontextmenu = () => false;
    mediaContainer.appendChild(img);
  }
};

const renderVariantSwitcher = (project, mediaContainer, initialVariantId) => {
  const switcherContainer = document.getElementById('project-variants');
  if (!switcherContainer) return;

  switcherContainer.innerHTML = '';

  if (!Array.isArray(project.variants) || project.variants.length === 0) {
    switcherContainer.style.display = 'none';
    return;
  }

  switcherContainer.style.display = '';

  const requestedIndex = project.variants.findIndex((variant) => variant.id === initialVariantId);
  const defaultIndex = project.variants.findIndex((variant) => variant.mediaSrc === project.mediaSrc);
  const startIndex = requestedIndex >= 0 ? requestedIndex : Math.max(0, defaultIndex);

  const buttons = project.variants.map((variant, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-btn';
    button.textContent = variant.label;
    button.classList.toggle('active', index === startIndex);
    button.addEventListener('click', () => {
      buttons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      renderProjectMedia(mediaContainer, {
        mediaType: variant.mediaType,
        mediaSrc: variant.mediaSrc,
        thumbnail: variant.thumbnail || project.thumbnail,
        title: project.title
      });
    });
    switcherContainer.appendChild(button);
    return button;
  });

  renderProjectMedia(mediaContainer, {
    mediaType: project.variants[startIndex].mediaType,
    mediaSrc: project.variants[startIndex].mediaSrc,
    thumbnail: project.variants[startIndex].thumbnail || project.thumbnail,
    title: project.title
  });
};

const renderProjectPage = (project, initialVariantId) => {
  if (!project) {
    document.body.innerHTML = '<div class="min-h-screen flex items-center justify-center"><p class="text-xl text-muted">Project not found</p></div>';
    return;
  }

  // Update page title
  const pageTitle = document.getElementById('project-title');
  if (pageTitle) {
    pageTitle.textContent = `${project.title} | MofeOluwa Oladeji`;
  }

  // Update project heading
  const heading = document.getElementById('project-heading');
  if (heading) {
    heading.textContent = project.title;
  }

  // Update project category
  const category = document.getElementById('project-category');
  if (category) {
    category.textContent = project.category;
  }

  // Update project date
  const date = document.getElementById('project-date');
  if (date && project.date) {
    date.textContent = project.date;
  }

  // Update project summary
  const summary = document.getElementById('project-summary');
  if (summary) {
    summary.textContent = project.summary;
  }

  // Update project description
  const description = document.getElementById('project-description');
  if (description) {
    description.textContent = project.description;
  }

  // Render project media (and variant switcher, if this project has style/version variants)
  const mediaContainer = document.getElementById('project-media');
  if (mediaContainer) {
    if (Array.isArray(project.variants) && project.variants.length > 0) {
      renderVariantSwitcher(project, mediaContainer, initialVariantId);
    } else {
      const switcherContainer = document.getElementById('project-variants');
      if (switcherContainer) switcherContainer.style.display = 'none';
      renderProjectMedia(mediaContainer, {
        mediaType: project.mediaType,
        mediaSrc: project.mediaSrc,
        thumbnail: project.thumbnail,
        title: project.title
      });
    }
  }

  // Render tools
  const toolsContainer = document.getElementById('project-tools');
  if (toolsContainer && project.tools) {
    toolsContainer.innerHTML = '';
    project.tools.forEach(tool => {
      const li = document.createElement('li');
      li.className = 'tag-pill';
      li.textContent = tool;
      toolsContainer.appendChild(li);
    });
  }

  // Render gallery
  const gallerySection = document.getElementById('project-gallery-section');
  const galleryContainer = document.getElementById('project-gallery');
  if (galleryContainer && project.gallery && project.gallery.length > 0) {
    gallerySection?.classList.remove('hidden');
    galleryContainer.innerHTML = '';
    project.gallery.forEach(image => {
      const img = document.createElement('img');
      img.src = image;
      img.alt = `${project.title} gallery image`;
      img.loading = 'lazy';
      img.className = 'w-full';
      img.oncontextmenu = () => false;
      galleryContainer.appendChild(img);
    });
  }

  // Render other categories
  const ALL_CATEGORIES = ['Motion Graphics', 'Animations', 'Illustrations', 'Drawings'];
  const otherCategoriesList = document.getElementById('other-categories-list');
  if (otherCategoriesList) {
    otherCategoriesList.innerHTML = '';
    const otherCategories = ALL_CATEGORIES.filter(cat => cat !== project.category);
    otherCategories.forEach(cat => {
      const anchor = document.createElement('a');
      anchor.href = `./index.html#portfolio`;
      anchor.dataset.filterCategory = cat;
      anchor.textContent = cat;
      anchor.className = 'tag-pill';
      anchor.setAttribute('aria-label', `View ${cat} projects`);

      // When clicked, store the desired filter in sessionStorage so index.html can pick it up on load
      anchor.addEventListener('click', () => {
        sessionStorage.setItem('portfolioFilter', cat);
      });

      otherCategoriesList.appendChild(anchor);
    });
  }

  // Setup navigation
  const navigation = getNavigationProjects(project);
  
  const prevLink = document.getElementById('prev-project');
  if (prevLink && navigation.prev?.id && navigation.prev?.category) {
    prevLink.href = `project.html?id=${encodeURIComponent(navigation.prev.id)}&category=${encodeURIComponent(navigation.prev.category)}`;
    const prevTitle = prevLink.querySelector('.prev-project-title');
    if (prevTitle) {
      prevTitle.textContent = navigation.prev.title;
    }
  }

  const nextLink = document.getElementById('next-project');
  if (nextLink && navigation.next?.id && navigation.next?.category) {
    nextLink.href = `project.html?id=${encodeURIComponent(navigation.next.id)}&category=${encodeURIComponent(navigation.next.category)}`;
    const nextTitle = nextLink.querySelector('.next-project-title');
    if (nextTitle) {
      nextTitle.textContent = navigation.next.title;
    }
  }
};

const handleMobileMenu = () => {
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (!mobileToggle || !mobileMenu) return;
  
  mobileToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
    const isOpen = mobileMenu.classList.contains('open');
    mobileToggle.setAttribute('aria-expanded', isOpen.toString());
  });

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      mobileToggle.setAttribute('aria-expanded', 'false');
    });
  });
};

const setProjectPageCurrentYear = () => {
  const yearNode = document.getElementById('year');
  if (yearNode) {
    yearNode.textContent = new Date().getFullYear().toString();
  }
};



// Custom Diamond Cursor Implementation
// Beige Pattern Animation Implementation
const initBeigePatterns = () => {
  const canvas = document.getElementById('beige-patterns-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let particles = [];
  
  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  class Particle {
    constructor(x, y) {
      this.baseX = x;
      this.baseY = y;
      this.x = x;
      this.y = y;
      this.size = Math.random() * 3 + 1;
      this.speedX = Math.random() * 2 - 1;
      this.speedY = Math.random() * 2 - 1;
      this.alpha = Math.random() * 0.5 + 0.2;
    }

    update() {
      const dx = mouseX - this.x;
      const dy = mouseY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 150;

      if (distance < maxDistance) {
        const force = (maxDistance - distance) / maxDistance;
        const angle = Math.atan2(dy, dx);
        this.x -= Math.cos(angle) * force * 3;
        this.y -= Math.sin(angle) * force * 3;
      } else {
        this.x += (this.baseX - this.x) * 0.05;
        this.y += (this.baseY - this.y) * 0.05;
      }

      this.x += this.speedX * 0.2;
      this.y += this.speedY * 0.2;
    }

    draw() {
      if (!ctx) return;
      ctx.fillStyle = `rgba(245, 240, 235, ${this.alpha})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const createParticles = () => {
    particles = [];
    const spacing = 80;
    const maxParticles = 150;
    let count = 0;
    
    for (let y = 0; y < canvas.height && count < maxParticles; y += spacing) {
      for (let x = 0; x < canvas.width && count < maxParticles; x += spacing) {
        particles.push(new Particle(x, y));
        count++;
      }
    }
  };

  createParticles();
  window.addEventListener('resize', createParticles);

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  const animate = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((particle) => {
      particle.update();
      particle.draw();
    });

    ctx.strokeStyle = 'rgba(245, 240, 235, 0.15)';
    ctx.lineWidth = 0.5;
    const maxConnectionsPerParticle = 3;

    for (let i = 0; i < particles.length; i++) {
      let connections = 0;
      for (let j = i + 1; j < particles.length && connections < maxConnectionsPerParticle; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
          connections++;
        }
      }
    }

    requestAnimationFrame(animate);
  };

  animate();
};

const initProjectPage = () => {
  const { id, variant } = getUrlParams();

  if (!id) {
    window.location.href = './index.html#portfolio';
    return;
  }

  const project = findProject(id);
  renderProjectPage(project, variant);
  handleMobileMenu();
  setProjectPageCurrentYear();
  initBeigePatterns();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProjectPage);
} else {
  initProjectPage();
}
