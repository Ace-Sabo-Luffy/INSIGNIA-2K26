/* ============================================================
   INSIGNIA — AI Interview Preparation Suite
   Application Logic (Python Backend + LLM Integration)
   ============================================================ */

const API_BASE = "http://localhost:5000/api";

// ==================== STATE ====================
const AppState = {
    profile: JSON.parse(localStorage.getItem('insignia_profile') || 'null'),
    stats: JSON.parse(localStorage.getItem('insignia_stats') || '{"resumes":0,"questions":0,"topics":0,"mocks":0}'),
    mockSession: null,
    mockTimer: null,
    mockSeconds: 0,
    studyProgress: JSON.parse(localStorage.getItem('insignia_study_progress') || '{}'),
    llmAvailable: false,
};

// ==================== INIT ====================
window.addEventListener('DOMContentLoaded', async () => {
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('fade-out');
    }, 2000);
    setupNavigation();
    
    // First, try loading data from backend Supabase
    await loadBackendData();
    
    // Then load into the UI
    loadProfile();
    updateStats();
    updateReadiness();
    checkBackendHealth();
});

async function loadBackendData() {
    try {
        const res = await fetch(`${API_BASE}/db/userdata`);
        const result = await res.json();
        if (result.success && result.data) {
            if (result.data.profile) AppState.profile = result.data.profile;
            if (result.data.stats) AppState.stats = result.data.stats;
            if (result.data.study_progress) AppState.studyProgress = result.data.study_progress;
            
            // Mirror to localStorage so it works offline
            localStorage.setItem('insignia_profile', JSON.stringify(AppState.profile));
            localStorage.setItem('insignia_stats', JSON.stringify(AppState.stats));
            localStorage.setItem('insignia_study_progress', JSON.stringify(AppState.studyProgress));
        }
    } catch (err) {
        console.warn("Could not load from DB, using localStorage", err);
    }
}

async function syncToDatabase() {
    try {
        await fetch(`${API_BASE}/db/userdata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profile: AppState.profile,
                stats: AppState.stats,
                study_progress: AppState.studyProgress
            })
        });
    } catch {
        console.warn("Failed to sync to database");
    }
}

function saveStateLocally() {
    localStorage.setItem('insignia_profile', JSON.stringify(AppState.profile));
    localStorage.setItem('insignia_stats', JSON.stringify(AppState.stats));
    localStorage.setItem('insignia_study_progress', JSON.stringify(AppState.studyProgress));
    syncToDatabase();
}

async function checkBackendHealth() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        const data = await res.json();
        AppState.llmAvailable = data.llm_available;
        
        // Database toast
        if (data.supabase_connected) {
            showToast('💾 Connected to Supabase DB', 'success');
        } else {
            showToast('⚠️ Synced locally (Supabase not configured)', 'info');
        }
        
        // LLM Toast slightly after
        setTimeout(() => {
            if (data.llm_available) {
                showToast('🤖 AI Engine connected (Gemini)', 'success');
            } else {
                showToast('⚠️ Backend running (LLM offline — using fallbacks)', 'info');
            }
        }, 1500);
        
    } catch {
        showToast('⚠️ Backend not reachable. Start server with: python server.py', 'error');
    }
}

// ==================== NAVIGATION ====================
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });
}

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    const navLink = document.querySelector(`[data-page="${page}"]`);
    if (navLink) navLink.classList.add('active');
}

// ==================== TOAST ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ==================== PROFILE ====================
function showProfileModal() { document.getElementById('profile-modal').style.display = 'flex'; }
function closeProfileModal() { document.getElementById('profile-modal').style.display = 'none'; }

function saveProfile(e) {
    e.preventDefault();
    AppState.profile = {
        name: document.getElementById('profile-name').value,
        role: document.getElementById('profile-role').value,
        level: document.getElementById('profile-level').value,
        domain: document.getElementById('profile-domain').value
    };
    saveStateLocally();
    loadProfile();
    closeProfileModal();
    showToast('Profile saved successfully!', 'success');
}

function loadProfile() {
    if (AppState.profile) {
        document.getElementById('display-user-name').textContent = AppState.profile.name;
        document.getElementById('display-user-role').textContent = AppState.profile.role || 'No role set';
        document.getElementById('profile-name').value = AppState.profile.name || '';
        document.getElementById('profile-role').value = AppState.profile.role || '';
        document.getElementById('profile-level').value = AppState.profile.level || 'fresher';
        document.getElementById('profile-domain').value = AppState.profile.domain || 'technology';
    }
}

// ==================== STATS ====================
function updateStats() {
    document.getElementById('stat-resumes').textContent = AppState.stats.resumes;
    document.getElementById('stat-questions').textContent = AppState.stats.questions;
    document.getElementById('stat-topics').textContent = AppState.stats.topics;
    document.getElementById('stat-mocks').textContent = AppState.stats.mocks;
}

function incrementStat(key, val = 1) {
    AppState.stats[key] = (AppState.stats[key] || 0) + val;
    saveStateLocally();
    updateStats();
    updateReadiness();
}

function updateReadiness() {
    const s = AppState.stats;
    const rp = Math.min(s.resumes * 25, 100);
    const qp = Math.min(s.questions * 2, 100);
    const tp = Math.min(s.topics * 5, 100);
    const mp = Math.min(s.mocks * 20, 100);
    const overall = Math.round((rp + qp + tp + mp) / 4);

    document.getElementById('resume-progress').style.width = rp + '%';
    document.getElementById('resume-progress-val').textContent = rp + '%';
    document.getElementById('qa-progress').style.width = qp + '%';
    document.getElementById('qa-progress-val').textContent = qp + '%';
    document.getElementById('topic-progress').style.width = tp + '%';
    document.getElementById('topic-progress-val').textContent = tp + '%';
    document.getElementById('mock-progress').style.width = mp + '%';
    document.getElementById('mock-progress-val').textContent = mp + '%';

    document.getElementById('readiness-value').textContent = overall;
    const circle = document.getElementById('readiness-circle');
    const circumference = 327;
    circle.style.strokeDashoffset = circumference - (circumference * overall / 100);
}

// ==================== RESUME BUILDER ====================
function addEducation() {
    const container = document.getElementById('education-entries');
    const block = document.createElement('div');
    block.className = 'entry-block';
    block.innerHTML = `<div class="form-grid"><div class="form-group"><label>Degree</label><input type="text" class="edu-degree" placeholder="M.S. in Data Science"></div><div class="form-group"><label>Institution</label><input type="text" class="edu-institution" placeholder="Stanford University"></div><div class="form-group"><label>Year</label><input type="text" class="edu-year" placeholder="2024 - 2026"></div><div class="form-group"><label>GPA</label><input type="text" class="edu-gpa" placeholder="3.9 / 4.0"></div></div>`;
    container.appendChild(block);
}

function addExperience() {
    const container = document.getElementById('experience-entries');
    const block = document.createElement('div');
    block.className = 'entry-block';
    block.innerHTML = `<div class="form-grid"><div class="form-group"><label>Job Title</label><input type="text" class="exp-title" placeholder="Software Engineer"></div><div class="form-group"><label>Company</label><input type="text" class="exp-company" placeholder="Amazon"></div><div class="form-group"><label>Duration</label><input type="text" class="exp-duration" placeholder="Jan 2024 - Present"></div></div><div class="form-group"><label>Key Responsibilities</label><textarea class="exp-desc" rows="3" placeholder="Describe contributions..."></textarea></div>`;
    container.appendChild(block);
}

function addProject() {
    const container = document.getElementById('project-entries');
    const block = document.createElement('div');
    block.className = 'entry-block';
    block.innerHTML = `<div class="form-grid"><div class="form-group"><label>Project Name</label><input type="text" class="proj-name" placeholder="Project Name"></div><div class="form-group"><label>Technologies</label><input type="text" class="proj-tech" placeholder="React, Python"></div></div><div class="form-group"><label>Description</label><textarea class="proj-desc" rows="2" placeholder="Brief description..."></textarea></div>`;
    container.appendChild(block);
}

async function generateResume(e) {
    e.preventDefault();
    const btn = document.getElementById('generate-resume-btn');
    btn.classList.add('loading');
    btn.disabled = true;

    const data = {
        name: document.getElementById('resume-name').value,
        email: document.getElementById('resume-email').value,
        phone: document.getElementById('resume-phone').value,
        location: document.getElementById('resume-location').value,
        linkedin: document.getElementById('resume-linkedin').value,
        portfolio: document.getElementById('resume-portfolio').value,
        targetRole: document.getElementById('resume-target-role').value,
        level: document.getElementById('resume-experience-level').value,
        summary: document.getElementById('resume-summary').value,
        skills: document.getElementById('resume-skills').value,
        education: [], experience: [], projects: []
    };

    document.querySelectorAll('#education-entries .entry-block').forEach(block => {
        const deg = block.querySelector('.edu-degree')?.value;
        if (deg) data.education.push({ degree: deg, institution: block.querySelector('.edu-institution')?.value || '', year: block.querySelector('.edu-year')?.value || '', gpa: block.querySelector('.edu-gpa')?.value || '' });
    });
    document.querySelectorAll('#experience-entries .entry-block').forEach(block => {
        const t = block.querySelector('.exp-title')?.value;
        if (t) data.experience.push({ title: t, company: block.querySelector('.exp-company')?.value || '', duration: block.querySelector('.exp-duration')?.value || '', desc: block.querySelector('.exp-desc')?.value || '' });
    });
    document.querySelectorAll('#project-entries .entry-block').forEach(block => {
        const n = block.querySelector('.proj-name')?.value;
        if (n) data.projects.push({ name: n, tech: block.querySelector('.proj-tech')?.value || '', desc: block.querySelector('.proj-desc')?.value || '' });
    });

    try {
        const res = await fetch(`${API_BASE}/generate-resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
            renderResumeFromAPI(data, result.data);
            document.getElementById('resume-preview-container').style.display = 'block';
            incrementStat('resumes');
            const source = result.llm_used ? '🤖 AI-Generated' : '📋 Template-Based';
            showToast(`Resume generated successfully! (${source})`, 'success');
        } else {
            throw new Error('Generation failed');
        }
    } catch (err) {
        console.error('Resume API error:', err);
        // Fallback to local generation
        renderResumeLocal(data);
        document.getElementById('resume-preview-container').style.display = 'block';
        incrementStat('resumes');
        showToast('Resume generated (offline mode)', 'info');
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

function renderResumeFromAPI(original, aiData) {
    const summary = aiData.summary || '';
    const skills = aiData.skills_enhanced || original.skills.split(',').map(s => s.trim()).filter(Boolean);
    const experience = aiData.experience_enhanced || [];

    let html = `<h1>${original.name}</h1>`;
    html += `<div class="contact-info">${[original.email, original.phone, original.location, original.linkedin, original.portfolio].filter(Boolean).join(' | ')}</div>`;
    html += `<h2>Professional Summary</h2><p>${summary}</p>`;

    if (original.education.length) {
        html += '<h2>Education</h2>';
        original.education.forEach(e => {
            html += `<h3>${e.degree} — ${e.institution}</h3><p>${[e.year, e.gpa ? 'GPA: ' + e.gpa : ''].filter(Boolean).join(' | ')}</p>`;
        });
    }

    if (experience.length) {
        html += '<h2>Professional Experience</h2>';
        experience.forEach(ex => {
            html += `<h3>${ex.title} — ${ex.company}</h3><p>${ex.duration}</p>`;
            if (ex.bullets && ex.bullets.length) {
                html += '<ul>' + ex.bullets.map(b => `<li>${b}</li>`).join('') + '</ul>';
            }
        });
    } else if (original.experience.length) {
        html += '<h2>Professional Experience</h2>';
        original.experience.forEach(ex => {
            html += `<h3>${ex.title} — ${ex.company}</h3><p>${ex.duration}</p>`;
            if (ex.desc) html += '<ul>' + ex.desc.split('\n').filter(Boolean).map(l => `<li>${l.replace(/^[-•]\s*/, '')}</li>`).join('') + '</ul>';
        });
    }

    if (original.projects.length) {
        html += '<h2>Projects</h2>';
        original.projects.forEach(p => {
            html += `<h3>${p.name} <span style="font-weight:400;color:#888;font-size:0.8em">[${p.tech}]</span></h3><p>${p.desc}</p>`;
        });
    }

    if (skills.length) {
        html += '<h2>Technical Skills</h2><ul class="skills-list">';
        skills.forEach(s => { html += `<li>${s}</li>`; });
        html += '</ul>';
    }

    document.getElementById('resume-preview').innerHTML = html;

    // Render AI suggestions
    const suggestions = aiData.suggestions || [];
    const list = document.getElementById('suggestions-list');
    list.innerHTML = suggestions.map(s => `<li>${s}</li>`).join('');
}

function renderResumeLocal(d) {
    const levels = { fresher: 'motivated and detail-oriented', junior: 'results-driven', mid: 'experienced and innovative', senior: 'seasoned and strategic', lead: 'visionary leader and architect' };
    const summary = d.summary || `${levels[d.level] || 'Motivated'} ${d.targetRole} with a strong foundation in ${d.skills.split(',').slice(0, 3).map(s => s.trim()).join(', ')}. Passionate about delivering high-quality solutions.`;
    const skillsArr = d.skills.split(',').map(s => s.trim()).filter(Boolean);

    let html = `<h1>${d.name}</h1><div class="contact-info">${[d.email, d.phone, d.location, d.linkedin, d.portfolio].filter(Boolean).join(' | ')}</div>`;
    html += `<h2>Professional Summary</h2><p>${summary}</p>`;

    if (d.education.length) {
        html += '<h2>Education</h2>';
        d.education.forEach(e => { html += `<h3>${e.degree} — ${e.institution}</h3><p>${[e.year, e.gpa ? 'GPA: ' + e.gpa : ''].filter(Boolean).join(' | ')}</p>`; });
    }
    if (d.experience.length) {
        html += '<h2>Professional Experience</h2>';
        d.experience.forEach(ex => { html += `<h3>${ex.title} — ${ex.company}</h3><p>${ex.duration}</p><ul>${ex.desc ? ex.desc.split('\n').filter(Boolean).map(l => `<li>${l.replace(/^[-•]\s*/, '')}</li>`).join('') : ''}</ul>`; });
    }
    if (d.projects.length) {
        html += '<h2>Projects</h2>';
        d.projects.forEach(p => { html += `<h3>${p.name} <span style="font-weight:400;color:#888;font-size:0.8em">[${p.tech}]</span></h3><p>${p.desc}</p>`; });
    }
    if (skillsArr.length) {
        html += '<h2>Technical Skills</h2><ul class="skills-list">';
        skillsArr.forEach(s => { html += `<li>${s}</li>`; });
        html += '</ul>';
    }

    document.getElementById('resume-preview').innerHTML = html;
    document.getElementById('suggestions-list').innerHTML = '<li>Connect to the AI backend for personalized suggestions</li>';
}

function downloadResume() {
    const content = document.getElementById('resume-preview').innerHTML;
    const blob = new Blob([`<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:2rem;max-width:800px;margin:0 auto;color:#1a1a2e}h1{font-size:1.5rem;margin-bottom:0.25rem}h2{font-size:0.95rem;color:#6C5CE7;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid #6C5CE7;padding-bottom:0.3rem;margin:1rem 0 0.5rem}h3{font-size:0.85rem;color:#333}p{color:#555;margin-bottom:0.35rem;font-size:0.82rem}.contact-info{color:#666;font-size:0.75rem;margin-bottom:0.75rem}ul{padding-left:1.25rem;color:#555;font-size:0.82rem}.skills-list{display:flex;flex-wrap:wrap;gap:0.35rem;list-style:none;padding:0}.skills-list li{background:#f0ecff;color:#6C5CE7;padding:0.2rem 0.6rem;border-radius:4px;font-size:0.72rem}</style></head><body>${content}</body></html>`], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'resume.html'; a.click();
    URL.revokeObjectURL(url);
    showToast('Resume downloaded!', 'success');
}

// ==================== Q&A GENERATOR ====================
let currentQuestions = []; // Store for feedback evaluation

async function generateQuestions() {
    const role = document.getElementById('qa-role').value;
    if (!role) { showToast('Please enter a target role', 'error'); return; }
    const level = document.getElementById('qa-level').value;
    const type = document.getElementById('qa-type').value;
    const count = document.getElementById('qa-count').value;

    const btn = document.getElementById('generate-qa-btn');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/generate-questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, level, type, count })
        });
        const result = await res.json();

        if (result.success && result.questions) {
            currentQuestions = result.questions;
            renderQuestions(result.questions);
            incrementStat('questions', result.questions.length);
            const source = result.llm_used ? '🤖 AI' : '📋 Bank';
            showToast(`Generated ${result.questions.length} questions (${source})`, 'success');
        } else {
            throw new Error('Failed');
        }
    } catch (err) {
        console.error('Q&A API error:', err);
        showToast('Could not reach backend. Check if server.py is running.', 'error');
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

function renderQuestions(questions) {
    const container = document.getElementById('qa-container');
    container.innerHTML = questions.map((q, i) => `
        <div class="qa-card" id="qa-card-${i}">
            <div class="qa-card-header" onclick="toggleQA(${i})">
                <div class="qa-number">${i + 1}</div>
                <div class="qa-question">${q.q}</div>
                <span class="qa-type-badge ${q.type}">${q.type}</span>
                <div class="qa-toggle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>
            </div>
            <div class="qa-body">
                <div class="qa-section-label">Model Answer</div>
                <div class="qa-answer">${q.a || q.ideal_answer || ''}</div>
                <div class="qa-section-label">Evaluation Criteria</div>
                <div class="qa-criteria">${q.criteria || (q.key_points ? q.key_points.join(', ') : '')}</div>
                <div class="qa-section-label">Practice Your Answer</div>
                <div class="qa-practice-area">
                    <textarea id="qa-practice-${i}" placeholder="Type your answer here to get AI feedback..."></textarea>
                    <div class="qa-practice-actions">
                        <button class="btn btn-sm btn-primary" onclick="evaluateAnswer(${i})">Get AI Feedback</button>
                    </div>
                    <div id="qa-feedback-${i}"></div>
                </div>
            </div>
        </div>
    `).join('');
}

function toggleQA(idx) {
    document.getElementById('qa-card-' + idx).classList.toggle('open');
}

async function evaluateAnswer(idx) {
    const answer = document.getElementById('qa-practice-' + idx).value;
    if (!answer || answer.length < 20) { showToast('Please write a more detailed answer', 'error'); return; }

    const q = currentQuestions[idx];
    const feedbackEl = document.getElementById('qa-feedback-' + idx);
    feedbackEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

    try {
        const res = await fetch(`${API_BASE}/evaluate-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: q.q,
                answer: answer,
                type: q.type,
                modelAnswer: q.a || q.ideal_answer || ''
            })
        });
        const result = await res.json();

        if (result.success) {
            const ev = result.evaluation;
            let html = `<div class="qa-feedback">`;
            html += `<strong>Score: ${ev.score}/100 — ${ev.score >= 80 ? 'Excellent!' : ev.score >= 60 ? 'Good' : 'Needs Improvement'}</strong><br>`;
            html += `${ev.feedback}`;
            if (ev.strengths && ev.strengths.length) {
                html += `<br><strong>Strengths:</strong> ${ev.strengths.join(', ')}`;
            }
            if (ev.improvements && ev.improvements.length) {
                html += `<br><strong>Improve:</strong> ${ev.improvements.join(', ')}`;
            }
            html += `</div>`;
            feedbackEl.innerHTML = html;
        } else {
            throw new Error('Evaluation failed');
        }
    } catch (err) {
        console.error('Evaluate error:', err);
        feedbackEl.innerHTML = '<div class="qa-feedback">Could not reach AI. Check if backend is running.</div>';
    }
}

// ==================== STUDY HUB ====================
const DOMAIN_NAMES = {
    'frontend': 'Frontend Developer',
    'backend': 'Backend Developer',
    'fullstack': 'Full Stack Developer',
    'data-science': 'Data Scientist',
    'data-analyst': 'Data Analyst',
    'devops': 'DevOps Engineer',
    'mobile': 'Mobile Developer',
    'ml-engineer': 'ML Engineer',
    'product-manager': 'Product Manager',
    'ux-designer': 'UX Designer',
    'cybersecurity': 'Cybersecurity Analyst',
    'cloud-architect': 'Cloud Architect',
    'marketing': 'Marketing Manager',
    'business-analyst': 'Business Analyst'
};

async function generateStudyPlan() {
    const domainKey = document.getElementById('study-domain').value;
    if (!domainKey) { showToast('Please select a domain', 'error'); return; }
    const level = document.getElementById('study-level').value;
    const domain = DOMAIN_NAMES[domainKey] || domainKey;

    const btn = document.querySelector('#page-study .btn-primary');
    if (btn) { btn.classList.add('loading'); btn.disabled = true; }

    try {
        const res = await fetch(`${API_BASE}/generate-study-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, level })
        });
        const result = await res.json();

        if (result.success && result.plan) {
            renderStudyPlan(result.plan);
            const source = result.llm_used ? '🤖 AI-Curated' : '📋 Template';
            showToast(`Study plan generated for ${domain}! (${source})`, 'success');
        } else {
            throw new Error('Failed');
        }
    } catch (err) {
        console.error('Study plan error:', err);
        showToast('Could not reach backend. Check if server.py is running.', 'error');
    } finally {
        if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
    }
}

function renderStudyPlan(data) {
    const container = document.getElementById('study-content');
    container.innerHTML = data.modules.map((mod, mi) => `
        <div class="study-module ${mi === 0 ? 'open' : ''}" id="study-mod-${mi}">
            <div class="study-module-header" onclick="toggleStudyModule(${mi})">
                <div class="study-module-number">${mi + 1}</div>
                <div class="study-module-info">
                    <div class="study-module-title">${mod.title}</div>
                    <div class="study-module-meta">${mod.topics.length} topics</div>
                </div>
                <div class="study-module-toggle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>
            </div>
            <div class="study-module-body">
                ${mod.topics.map((topic, ti) => `
                    <div class="study-topic">
                        <h4>${topic.name}</h4>
                        <p>${topic.desc}</p>
                        <ul class="key-points">${topic.points.map(p => `<li>${p}</li>`).join('')}</ul>
                        <label class="study-check ${isTopicCompleted(mi, ti) ? 'completed' : ''}">
                            <input type="checkbox" ${isTopicCompleted(mi, ti) ? 'checked' : ''} onchange="toggleTopicCompletion(${mi}, ${ti}, this)">
                            Mark as completed
                        </label>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function toggleStudyModule(idx) { document.getElementById('study-mod-' + idx).classList.toggle('open'); }

function isTopicCompleted(mi, ti) { return AppState.studyProgress[`${mi}-${ti}`] === true; }

function toggleTopicCompletion(mi, ti, el) {
    const key = `${mi}-${ti}`;
    AppState.studyProgress[key] = el.checked;
    saveStateLocally();
    el.parentElement.classList.toggle('completed', el.checked);
    if (el.checked) incrementStat('topics');
}

// ==================== MOCK INTERVIEW ====================
async function startMockInterview() {
    const role = document.getElementById('mock-role').value;
    if (!role) { showToast('Please enter a target role', 'error'); return; }
    const type = document.getElementById('mock-type').value;
    const count = parseInt(document.getElementById('mock-questions-count').value);
    const level = document.getElementById('mock-level').value;

    try {
        const res = await fetch(`${API_BASE}/generate-mock-questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, level, type, count })
        });
        const result = await res.json();

        if (result.success && result.questions) {
            AppState.mockSession = {
                role, questions: result.questions, currentIndex: 0,
                answers: [], startTime: Date.now(), llmUsed: result.llm_used
            };
            AppState.mockSeconds = 0;

            document.getElementById('mock-setup').style.display = 'none';
            document.getElementById('mock-session').style.display = 'block';
            document.getElementById('mock-results').style.display = 'none';

            startMockTimer();
            showMockQuestion();
        } else {
            throw new Error('Failed');
        }
    } catch (err) {
        console.error('Mock start error:', err);
        showToast('Could not reach backend. Check if server.py is running.', 'error');
    }
}

function startMockTimer() {
    clearInterval(AppState.mockTimer);
    AppState.mockTimer = setInterval(() => {
        AppState.mockSeconds++;
        const mins = Math.floor(AppState.mockSeconds / 60).toString().padStart(2, '0');
        const secs = (AppState.mockSeconds % 60).toString().padStart(2, '0');
        document.getElementById('mock-timer').textContent = `${mins}:${secs}`;
    }, 1000);
}

function showMockQuestion() {
    const s = AppState.mockSession;
    const q = s.questions[s.currentIndex];
    const total = s.questions.length;

    document.getElementById('mock-question-counter').textContent = `Question ${s.currentIndex + 1} of ${total}`;
    document.getElementById('mock-progress-fill').style.width = `${((s.currentIndex) / total) * 100}%`;
    document.getElementById('mock-q-type').textContent = q.type;
    document.getElementById('mock-question-text').textContent = q.q;
    document.getElementById('mock-answer-input').value = '';
    document.getElementById('mock-answer-input').focus();
}

function submitMockAnswer() {
    const answer = document.getElementById('mock-answer-input').value;
    if (!answer.trim()) { showToast('Please type an answer before submitting', 'error'); return; }
    AppState.mockSession.answers.push({ answer, skipped: false });
    advanceMock();
}

function skipMockQuestion() {
    AppState.mockSession.answers.push({ answer: '(Skipped)', skipped: true });
    advanceMock();
}

function advanceMock() {
    const s = AppState.mockSession;
    s.currentIndex++;
    if (s.currentIndex >= s.questions.length) {
        finishMockInterview();
    } else {
        showMockQuestion();
    }
}

async function finishMockInterview() {
    clearInterval(AppState.mockTimer);
    document.getElementById('mock-session').style.display = 'none';
    document.getElementById('mock-results').style.display = 'block';

    const s = AppState.mockSession;

    // Show loading state
    document.getElementById('mock-feedback-list').innerHTML = '<div class="typing-indicator" style="padding:2rem;text-align:center"><span></span><span></span><span></span><p style="margin-top:1rem;color:#aaa">AI is evaluating your answers...</p></div>';

    // Evaluate each answer via API
    const results = [];
    for (let i = 0; i < s.questions.length; i++) {
        const q = s.questions[i];
        const ans = s.answers[i];

        if (ans.skipped) {
            results.push({
                ...q, answer: '(Skipped)', score: 0,
                feedback: 'Question was skipped. Attempting all questions shows confidence and willingness to engage.',
                rating: 'skipped'
            });
            continue;
        }

        try {
            const res = await fetch(`${API_BASE}/evaluate-mock-answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: q.q,
                    answer: ans.answer,
                    idealAnswer: q.ideal_answer || q.a || '',
                    type: q.type,
                    keyPoints: q.key_points || []
                })
            });
            const result = await res.json();
            const ev = result.evaluation;
            results.push({
                ...q, answer: ans.answer,
                score: ev.score, feedback: ev.feedback,
                rating: ev.rating || 'average'
            });
        } catch {
            // Fallback scoring
            const wc = ans.answer.split(/\s+/).length;
            const score = Math.min(95, Math.max(30, 45 + wc + 10));
            results.push({
                ...q, answer: ans.answer, score,
                feedback: 'Could not get AI feedback. Score based on response length.',
                rating: score >= 70 ? 'strong' : 'average'
            });
        }
    }

    // Calculate totals
    const totalScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
    const answered = results.filter(r => !r.answer.includes('Skipped')).length;
    const goodAnswers = results.filter(r => r.score >= 70).length;

    // Animate score ring
    const ring = document.getElementById('mock-score-ring');
    const circumference = 327;
    setTimeout(() => { ring.style.strokeDashoffset = circumference - (circumference * totalScore / 100); }, 100);
    document.getElementById('mock-final-score').textContent = totalScore;

    document.getElementById('mock-score-breakdown').innerHTML = `
        <div class="score-metric"><div class="score-metric-label">Questions Answered</div><div class="score-metric-value">${answered}/${results.length}</div></div>
        <div class="score-metric"><div class="score-metric-label">Strong Answers</div><div class="score-metric-value">${goodAnswers}</div></div>
        <div class="score-metric"><div class="score-metric-label">Time Taken</div><div class="score-metric-value">${document.getElementById('mock-timer').textContent}</div></div>
        <div class="score-metric"><div class="score-metric-label">Avg Score</div><div class="score-metric-value">${totalScore}/100</div></div>
    `;

    document.getElementById('mock-feedback-list').innerHTML = results.map((r, i) => {
        const badge = r.score >= 70 ? 'good' : r.score >= 50 ? 'average' : 'poor';
        const badgeLabel = r.score >= 70 ? '✓ Strong' : r.score >= 50 ? '~ Average' : '✗ Weak';
        return `<div class="mock-feedback-item">
            <div class="question-label">Question ${i + 1} — ${r.type}</div>
            <div class="score-badge ${badge}">${badgeLabel} (${r.score}/100)</div>
            <div class="question-text">${r.q}</div>
            <div class="answer-text">"${r.answer}"</div>
            <div class="feedback-text">${r.feedback}</div>
        </div>`;
    }).join('');

    incrementStat('mocks');
    showToast('Mock interview completed! Review your performance.', 'success');
}

function resetMockInterview() {
    AppState.mockSession = null;
    clearInterval(AppState.mockTimer);
    document.getElementById('mock-setup').style.display = 'flex';
    document.getElementById('mock-session').style.display = 'none';
    document.getElementById('mock-results').style.display = 'none';
    document.getElementById('mock-score-ring').style.strokeDashoffset = 327;
}

// Profile button click
document.getElementById('user-profile-btn')?.addEventListener('click', showProfileModal);

// ==================== SKILL CONNECT ====================
async function findSkillMatches() {
    const haveEls = Array.from(document.querySelectorAll('#skills-have-list .skill-pill.selected'));
    const wantEls = Array.from(document.querySelectorAll('#skills-want-list .skill-pill.selected'));
    
    const have = haveEls.map(el => el.textContent.trim()).join(', ');
    const want = wantEls.map(el => el.textContent.trim()).join(', ');
    
    if (!have || !want) {
        showToast('Please select at least one skill you have and one you want to learn!', 'error');
        return;
    }

    const container = document.getElementById('connect-matches-container');
    container.innerHTML = '<div class="loader" style="margin: 3rem auto;"></div><p style="text-align:center;width:100%">Analyzing profiles using AI matching...</p>';
    
    const btn = event.currentTarget || document.querySelector("#page-skill-connect button");
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/skill-connect/match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ have, want })
        });
        const data = await res.json();
        
        if(data.success && data.matches) {
            renderMatches(data.matches);
            showToast(data.llm_used ? 'AI found perfect matches for you!' : 'Used offline data bank to find matches.', 'success');
        } else {
            throw new Error("Match failed");
        }
    } catch(err) {
        showToast('Failed to find matches. Please ensure server is running.', 'error');
        container.innerHTML = '';
    } finally {
        btn.disabled = false;
    }
}

function renderMatches(matches) {
    const container = document.getElementById('connect-matches-container');
    container.innerHTML = '';
    
    matches.forEach(m => {
        const div = document.createElement('div');
        div.className = 'glass-card hover-glow';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '15px';
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap: 12px; align-items:center;">
                    <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg, var(--primary), var(--secondary)); display:flex; align-items:center; justify-content:center; font-weight:bold;">
                        ${m.name.charAt(0)}
                    </div>
                    <div>
                        <h3 style="margin:0; font-size:16px;">${m.name}</h3>
                        <p style="margin:0; font-size:12px; color:var(--text-muted)">${m.role}</p>
                    </div>
                </div>
                <div style="background: rgba(0, 210, 255, 0.1); color: var(--secondary); padding: 4px 10px; border-radius: 20px; font-weight: bold; font-size: 13px;">
                    ${m.match_score}% Match
                </div>
            </div>
            
            <p style="font-size:14px; margin:0;">${m.bio}</p>
            
            <div style="margin-top:auto">
                <div style="margin-bottom:12px">
                    <span style="font-size:12px; color:var(--primary); font-weight:bold;">Can Teach You:</span>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
                        ${m.can_teach_you.map(s => `<span class="tag" style="background: var(--primary); color: white">${s}</span>`).join('')}
                    </div>
                </div>
                <div>
                    <span style="font-size:12px; color:var(--secondary); font-weight:bold;">Wants to Learn:</span>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
                        ${m.wants_to_learn_from_you.map(s => `<span class="tag" style="background: var(--glass-bg); color: #fff">${s}</span>`).join('')}
                    </div>
                </div>
            </div>
            
            <button class="btn btn-outline" style="margin-top: 15px; width: 100%" onclick="showToast('Connection request sent to ${m.name}!', 'success')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 5px;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                Connect & Practice
            </button>
        `;
        container.appendChild(div);
    });
}
