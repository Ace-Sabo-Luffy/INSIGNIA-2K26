"""
============================================================
INSIGNIA — AI Interview Preparation Suite
Flask Backend with Google Gemini LLM Integration
============================================================
"""

import os
import json
import time
from flask import Flask, request, jsonify, send_from_directory  # type: ignore
from flask_cors import CORS  # type: ignore
from dotenv import load_dotenv  # type: ignore
import google.generativeai as genai  # type: ignore
import requests  # type: ignore

# ── Load environment ──────────────────────────────────────
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
    print("\nWARNING: No valid GEMINI_API_KEY found!")
    print("   Get a free API key at: https://aistudio.google.com/apikey")
    print("   Then add it to the .env file\n")
    LLM_AVAILABLE = False
else:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.0-flash")
    LLM_AVAILABLE = True
    print("✅ Gemini LLM connected successfully!")

# ── Flask App ─────────────────────────────────────────────
app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

# ── Serve Frontend ────────────────────────────────────────
@app.route("/")
def serve_index():
    return send_from_directory(".", "index.html")


# ── Helper: Call LLM ──────────────────────────────────────
def call_llm(prompt, fallback=""):
    """Call Gemini LLM with error handling and fallback."""
    if not LLM_AVAILABLE:
        return fallback
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"LLM Error: {e}")
        return fallback


def call_llm_json(prompt, fallback=None):
    """Call Gemini LLM expecting JSON output."""
    if not LLM_AVAILABLE:
        return fallback
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        # Extract JSON from markdown code blocks if present
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception as e:
        print(f"LLM JSON Error: {e}")
        return fallback


# ══════════════════════════════════════════════════════════
# API ENDPOINTS
# ══════════════════════════════════════════════════════════

# ── 1. RESUME GENERATION ─────────────────────────────────
@app.route("/api/generate-resume", methods=["POST"])
def generate_resume():
    data = request.json

    prompt = f"""You are an expert resume writer and career coach. Generate a professional, ATS-optimized resume based on the following information.

CANDIDATE DETAILS:
- Name: {data.get('name', 'N/A')}
- Email: {data.get('email', '')}
- Phone: {data.get('phone', '')}
- Location: {data.get('location', '')}
- LinkedIn: {data.get('linkedin', '')}
- Portfolio: {data.get('portfolio', '')}
- Target Role: {data.get('targetRole', 'Software Engineer')}
- Experience Level: {data.get('level', 'fresher')}
- Provided Summary: {data.get('summary', '')}
- Skills: {data.get('skills', '')}
- Education: {json.dumps(data.get('education', []))}
- Experience: {json.dumps(data.get('experience', []))}
- Projects: {json.dumps(data.get('projects', []))}

Return a JSON object with EXACTLY this structure:
{{
    "summary": "A compelling 2-3 sentence professional summary tailored to the target role. Use strong action words and quantify achievements where possible.",
    "skills_enhanced": ["skill1", "skill2", ...],
    "experience_enhanced": [
        {{
            "title": "Job Title",
            "company": "Company",
            "duration": "Duration",
            "bullets": ["Achievement bullet 1 starting with action verb", "Achievement bullet 2"]
        }}
    ],
    "suggestions": [
        "Specific actionable improvement suggestion 1",
        "Specific actionable improvement suggestion 2",
        "Specific actionable improvement suggestion 3",
        "Specific actionable improvement suggestion 4",
        "Specific actionable improvement suggestion 5"
    ]
}}

IMPORTANT RULES:
- The summary must be tailored to the target role "{data.get('targetRole', 'Software Engineer')}"
- Each experience bullet must start with a strong action verb (Developed, Architected, Optimized, etc.)
- Include quantifiable metrics where possible (increased by X%, reduced by Y%)
- Suggestions should be specific and actionable, not generic
- If skills are provided, enhance and categorize them
- Return ONLY valid JSON, no markdown or explanation"""

    fallback = {
        "summary": _generate_fallback_summary(data),
        "skills_enhanced": [s.strip() for s in data.get("skills", "").split(",") if s.strip()],
        "experience_enhanced": [
            {
                "title": exp.get("title", ""),
                "company": exp.get("company", ""),
                "duration": exp.get("duration", ""),
                "bullets": [b.strip() for b in exp.get("desc", "").split("\n") if b.strip()]
            }
            for exp in data.get("experience", []) if exp.get("title")
        ],
        "suggestions": [
            "Add quantifiable achievements to your experience bullets (e.g., 'Improved performance by 40%')",
            "Include a GitHub/portfolio link — 87% of recruiters check online profiles",
            "Tailor your professional summary with keywords from the job description",
            "Add 8-10 relevant technical skills for better ATS compatibility",
            "Use strong action verbs: Architected, Optimized, Spearheaded, Implemented"
        ]
    }

    result = call_llm_json(prompt, fallback)
    return jsonify({"success": True, "data": result, "llm_used": LLM_AVAILABLE})


def _generate_fallback_summary(data):
    levels = {
        "fresher": "motivated and detail-oriented",
        "junior": "results-driven",
        "mid": "experienced and innovative",
        "senior": "seasoned and strategic",
        "lead": "visionary leader and architect"
    }
    skills_list = data.get("skills", "programming").split(",")[:3]
    skills_str = ", ".join(s.strip() for s in skills_list)
    return (
        f"{levels.get(data.get('level', 'fresher'), 'Motivated')} "
        f"{data.get('targetRole', 'professional')} with a strong foundation in {skills_str}. "
        f"Passionate about delivering high-quality solutions and continuously expanding technical expertise."
    )


# ── 2. Q&A GENERATION ────────────────────────────────────
@app.route("/api/generate-questions", methods=["POST"])
def generate_questions():
    data = request.json
    role = data.get("role", "Software Engineer")
    level = data.get("level", "mid")
    qtype = data.get("type", "all")
    count = int(data.get("count", 10))

    type_instruction = ""
    if qtype == "technical":
        type_instruction = "Generate ONLY technical questions."
    elif qtype == "behavioral":
        type_instruction = "Generate ONLY behavioral questions."
    elif qtype == "situational":
        type_instruction = "Generate ONLY situational questions."
    else:
        type_instruction = "Generate a good mix of technical, behavioral, and situational questions."

    prompt = f"""You are an expert technical interviewer. Generate exactly {count} interview questions for a {level}-level {role} position.

{type_instruction}

Return a JSON array where each item has this EXACT structure:
[
    {{
        "q": "The interview question",
        "a": "A comprehensive model answer (3-5 sentences with specific examples)",
        "type": "technical|behavioral|situational",
        "criteria": "What the interviewer is evaluating (1-2 sentences)"
    }}
]

RULES:
- Questions must be relevant to a {role} at {level} level
- Model answers should be specific and detailed, not generic
- Include real-world examples and best practices in answers
- Technical questions should test actual knowledge, not trivia
- Behavioral questions should be answerable with the STAR method
- Return ONLY a valid JSON array, no markdown or extra text"""

    fallback = _get_fallback_questions(role, qtype, count)
    result = call_llm_json(prompt, fallback)

    if result is None:
        result = fallback

    return jsonify({"success": True, "questions": result, "llm_used": LLM_AVAILABLE})


def _get_fallback_questions(role, qtype, count):
    """Fallback question bank when LLM is unavailable."""
    technical = [
        {"q": f"What are the key skills needed for a {role}?", "a": f"A strong {role} needs a combination of technical skills specific to the domain, problem-solving abilities, and soft skills like communication and teamwork.", "type": "technical", "criteria": "Domain knowledge and self-awareness"},
        {"q": "Explain the difference between SQL and NoSQL databases.", "a": "SQL databases are relational, use structured schemas, and support ACID transactions. NoSQL databases are non-relational, schema-flexible, and optimized for horizontal scaling. Choose SQL for complex queries and data integrity; NoSQL for scalability and flexible data models.", "type": "technical", "criteria": "Database fundamentals"},
        {"q": "What is the difference between REST and GraphQL?", "a": "REST uses multiple endpoints with fixed data structures, while GraphQL uses a single endpoint where clients specify exactly what data they need. GraphQL reduces over/under-fetching but adds complexity.", "type": "technical", "criteria": "API design understanding"},
        {"q": "Explain the concept of caching and its benefits.", "a": "Caching stores frequently accessed data in fast storage (memory) to reduce database queries and improve response times. Strategies include in-memory (Redis), CDN, browser caching, and application-level caching.", "type": "technical", "criteria": "Performance optimization knowledge"},
        {"q": "What are design patterns and why are they important?", "a": "Design patterns are proven solutions to common software design problems. Key patterns include Singleton, Factory, Observer, and Strategy. They improve code maintainability, readability, and team communication.", "type": "technical", "criteria": "Software design principles"},
    ]
    behavioral = [
        {"q": "Tell me about a time you faced a challenging technical problem.", "a": "Use the STAR method: Describe the Situation, Task, Actions taken, and Results achieved. Focus on your problem-solving approach and the positive outcome.", "type": "behavioral", "criteria": "Problem-solving, persistence, STAR method usage"},
        {"q": "How do you handle disagreements with team members?", "a": "I listen to understand their perspective, share my reasoning with data, and work toward a solution that serves the project goals. When consensus isn't possible, I defer to the decision-maker.", "type": "behavioral", "criteria": "Conflict resolution, teamwork, communication"},
        {"q": "Describe a time you had to learn something new quickly.", "a": "Focus on your learning strategy: structured approach, breaking down the topic, hands-on practice, seeking mentorship, and how you applied the new knowledge successfully.", "type": "behavioral", "criteria": "Learning agility, adaptability"},
        {"q": "Tell me about your biggest professional achievement.", "a": "Choose an achievement relevant to the role. Quantify the impact, explain your specific contribution, and connect it to skills needed for this position.", "type": "behavioral", "criteria": "Self-awareness, impact-driven mindset"},
        {"q": "How do you handle tight deadlines?", "a": "I prioritize tasks using urgency/importance frameworks, communicate proactively with stakeholders about trade-offs, break work into manageable chunks, and focus on delivering the most critical features first.", "type": "behavioral", "criteria": "Time management, prioritization, communication"},
    ]
    situational = [
        {"q": "If you discovered a critical bug in production, what would you do?", "a": "Immediately assess impact, notify the team and stakeholders, apply a quick fix or rollback if possible, document the incident, and conduct a post-mortem to prevent recurrence.", "type": "situational", "criteria": "Crisis management, communication, judgment"},
        {"q": "How would you onboard yourself to a new codebase?", "a": "Start with documentation and architecture diagrams, set up local environment, trace key user flows through the code, pair with experienced team members, and make small bug fixes to build confidence.", "type": "situational", "criteria": "Self-direction, systematic approach"},
        {"q": "If your manager asked you to cut corners on quality, how would you respond?", "a": "I'd respectfully present the risks of technical debt, propose alternatives that balance speed and quality, and suggest a plan to address shortcuts in future sprints.", "type": "situational", "criteria": "Professional integrity, communication"},
    ]

    all_qs = []
    if qtype in ("technical", "all"):
        all_qs.extend(technical)
    if qtype in ("behavioral", "all"):
        all_qs.extend(behavioral)
    if qtype in ("situational", "all"):
        all_qs.extend(situational)
    
    import random
    random.shuffle(all_qs)
    limit = int(count)
    return [all_qs[i] for i in range(min(limit, len(all_qs)))]


# ── 3. EVALUATE ANSWER ────────────────────────────────────
@app.route("/api/evaluate-answer", methods=["POST"])
def evaluate_answer():
    data = request.json
    question = data.get("question", "")
    answer = data.get("answer", "")
    qtype = data.get("type", "technical")
    model_answer = data.get("modelAnswer", "")

    prompt = f"""You are an expert interview coach evaluating a candidate's answer.

QUESTION: {question}
QUESTION TYPE: {qtype}
CANDIDATE'S ANSWER: {answer}
MODEL ANSWER (for reference): {model_answer}

Evaluate the candidate's answer and return a JSON object:
{{
    "score": <number 0-100>,
    "feedback": "Detailed feedback in 2-3 sentences. Be specific about what was good and what can be improved. Reference specific parts of their answer.",
    "strengths": ["specific strength 1", "specific strength 2"],
    "improvements": ["specific improvement 1", "specific improvement 2"]
}}

SCORING GUIDELINES:
- 90-100: Exceptional, covers all key points with examples
- 75-89: Strong, covers most key points
- 60-74: Adequate, missing some important details
- 40-59: Below average, significant gaps
- 0-39: Poor, does not address the question

Return ONLY valid JSON."""

    # Fallback scoring
    word_count = len(answer.split())
    fallback_score = min(95, max(30, 45 + word_count + 10))
    feedback_text = ""
    if fallback_score >= 80:
        feedback_text = "Strong answer demonstrating good understanding. "
    elif fallback_score >= 60:
        feedback_text = "Solid foundation. "
    else:
        feedback_text = "Needs more depth and detail. "

    if word_count < 25:
        feedback_text += "Try to elaborate more with specific examples. "
    if qtype == "behavioral" and "result" not in answer.lower():
        feedback_text += "Use the STAR method — include specific Results. "

    fallback = {
        "score": fallback_score,
        "feedback": feedback_text,
        "strengths": ["Shows understanding of the topic"],
        "improvements": ["Add more specific examples", "Include quantifiable results"]
    }

    result = call_llm_json(prompt, fallback)
    return jsonify({"success": True, "evaluation": result, "llm_used": LLM_AVAILABLE})


# ── 4. STUDY PLAN GENERATION ──────────────────────────────
@app.route("/api/generate-study-plan", methods=["POST"])
def generate_study_plan():
    data = request.json
    domain = data.get("domain", "Software Engineer")
    level = data.get("level", "intermediate")

    prompt = f"""You are an expert technical educator. Generate a comprehensive study plan for someone preparing for a {domain} interview at the {level} level.

Return a JSON object with this EXACT structure:
{{
    "title": "{domain}",
    "modules": [
        {{
            "title": "Module Title (e.g., Core Fundamentals)",
            "topics": [
                {{
                    "name": "Topic Name",
                    "desc": "One sentence description of what to learn",
                    "points": [
                        "Specific subtopic or concept to study 1",
                        "Specific subtopic or concept to study 2",
                        "Specific subtopic or concept to study 3"
                    ]
                }}
            ]
        }}
    ]
}}

REQUIREMENTS:
- Generate 4-5 modules with 2-3 topics each
- Topics should progress from foundational to advanced
- Points should be specific and actionable
- Tailor content to the {level} level
- Focus on interview-relevant knowledge
- Return ONLY valid JSON"""

    fallback = _get_fallback_study_plan(domain)
    result = call_llm_json(prompt, fallback)
    return jsonify({"success": True, "plan": result, "llm_used": LLM_AVAILABLE})


def _get_fallback_study_plan(domain):
    """Fallback study plan data."""
    return {
        "title": domain,
        "modules": [
            {"title": "Core Fundamentals", "topics": [
                {"name": "Key Concepts", "desc": "Master the foundational concepts.", "points": ["Core principles and terminology", "Industry standards", "Common tools and frameworks"]},
                {"name": "Best Practices", "desc": "Learn industry best practices.", "points": ["Code quality standards", "Testing strategies", "Documentation practices"]}
            ]},
            {"title": "Advanced Topics", "topics": [
                {"name": "System Design", "desc": "Design scalable systems.", "points": ["Architecture patterns", "Scalability strategies", "Performance optimization"]},
                {"name": "Problem Solving", "desc": "Strengthen analytical skills.", "points": ["Algorithm design", "Data structures", "Optimization techniques"]}
            ]},
            {"title": "Interview Preparation", "topics": [
                {"name": "Common Questions", "desc": "Practice frequently asked questions.", "points": ["Technical deep-dives", "Behavioral scenarios", "System design exercises"]},
                {"name": "Mock Practice", "desc": "Simulate real interviews.", "points": ["Timed problem solving", "Communication practice", "Whiteboard exercises"]}
            ]}
        ]
    }


# ── 5. MOCK INTERVIEW ────────────────────────────────────
@app.route("/api/generate-mock-questions", methods=["POST"])
def generate_mock_questions():
    data = request.json
    role = data.get("role", "Software Engineer")
    level = data.get("level", "mid")
    qtype = data.get("type", "mixed")
    count = int(data.get("count", 5))

    type_desc = "a mix of technical and behavioral" if qtype == "mixed" else qtype

    prompt = f"""Generate exactly {count} {type_desc} interview questions for a {level}-level {role}.

Return a JSON array:
[
    {{
        "q": "Interview question",
        "type": "technical|behavioral|situational",
        "ideal_answer": "The ideal comprehensive answer in 3-4 sentences",
        "key_points": ["key point 1", "key point 2", "key point 3"]
    }}
]

Questions should be challenging but fair for a {level}-level candidate.
Return ONLY the JSON array."""

    fallback = _get_fallback_questions(role, "all" if qtype == "mixed" else qtype, count)
    # Adapt fallback format for mock
    adapted = []
    for q in fallback:
        adapted.append({
            "q": q["q"],
            "type": q["type"],
            "ideal_answer": q["a"],
            "key_points": q.get("criteria", "").split(", ")
        })

    result = call_llm_json(prompt, adapted)
    return jsonify({"success": True, "questions": result, "llm_used": LLM_AVAILABLE})


@app.route("/api/evaluate-mock-answer", methods=["POST"])
def evaluate_mock_answer():
    data = request.json
    question = data.get("question", "")
    answer = data.get("answer", "")
    ideal = data.get("idealAnswer", "")
    qtype = data.get("type", "technical")
    key_points = data.get("keyPoints", [])

    if not answer or answer == "(Skipped)":
        return jsonify({
            "success": True,
            "evaluation": {
                "score": 0,
                "feedback": "Question was skipped. Attempting all questions shows confidence and willingness to engage.",
                "rating": "skipped"
            },
            "llm_used": False
        })

    prompt = f"""Evaluate this interview answer on a 0-100 scale.

QUESTION ({qtype}): {question}
CANDIDATE'S ANSWER: {answer}
IDEAL ANSWER: {ideal}
KEY POINTS TO COVER: {', '.join(key_points) if key_points else 'N/A'}

Return JSON:
{{
    "score": <0-100>,
    "feedback": "2-3 sentences of specific, constructive feedback. Mention what was done well and what's missing.",
    "rating": "excellent|strong|good|average|weak"
}}

Scoring: 85+ excellent, 70-84 strong, 55-69 good, 40-54 average, below 40 weak.
Return ONLY valid JSON."""

    word_count = len(answer.split())
    fallback_score = min(95, max(30, 45 + word_count + 10))
    fallback_rating = "excellent" if fallback_score >= 85 else "strong" if fallback_score >= 70 else "good" if fallback_score >= 55 else "average" if fallback_score >= 40 else "weak"
    fallback = {
        "score": fallback_score,
        "feedback": f"Your answer shows {'strong' if fallback_score >= 70 else 'some'} understanding. Consider adding more specific examples and technical detail.",
        "rating": fallback_rating
    }

    result = call_llm_json(prompt, fallback)
    return jsonify({"success": True, "evaluation": result, "llm_used": LLM_AVAILABLE})


# ── 6. HEALTH CHECK ───────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ok",
        "llm_available": LLM_AVAILABLE,
        "llm_model": "gemini-2.0-flash" if LLM_AVAILABLE else None,
        "supabase_connected": bool(SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL != "your_supabase_project_url_here"),
        "timestamp": time.time()
    })


# ── 7. SUPABASE DATABASE ENDPOINTS ────────────────────────
def get_supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
    }

@app.route("/api/db/userdata", methods=["GET"])
def get_user_data():
    if not (SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL != "your_supabase_project_url_here"):
        return jsonify({"success": False, "error": "Supabase not configured in .env"})
    
    # Using a fixed ID for the single-user demo
    user_id = "default_user_1"
    url = f"{SUPABASE_URL}/rest/v1/user_data?id=eq.{user_id}&select=*"
    
    try:
        response = requests.get(url, headers=get_supabase_headers())
        data = response.json()
        if response.status_code == 200 and len(data) > 0:
            return jsonify({"success": True, "data": data[0]})
        return jsonify({"success": True, "data": None})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/api/db/userdata", methods=["POST"])
def save_user_data():
    if not (SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL != "your_supabase_project_url_here"):
        return jsonify({"success": False, "error": "Supabase not configured in .env"})
        
    payload = request.json
    payload["id"] = "default_user_1" # Enforce the fixed demo ID
    
    url = f"{SUPABASE_URL}/rest/v1/user_data"
    
    try:
        # POST with Prefer: resolution=merge-duplicates acts like an Upsert
        response = requests.post(url, headers=get_supabase_headers(), json=payload)
        if response.status_code in (200, 201):
            return jsonify({"success": True, "data": response.json()[0] if response.json() else payload})
        return jsonify({"success": False, "error": response.text})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


# ── 8. SKILL CONNECT MATCHING ────────────────────────────
@app.route("/api/skill-connect/match", methods=["POST"])
def generate_skill_matches():
    data = request.json
    have = data.get("have", "")
    want = data.get("want", "")
    
    prompt = f"""You are an intelligent peer-matching system in a technical interview prep app. 
The current user has these skills: {have}
The current user wants to learn these skills: {want}

Generate 3 diverse, realistic peer profiles that would be great matches for this user to study or mock interview with.
The matches should ideally know something the user wants to learn, and want to learn something the user knows.

Return a JSON array of precisely 3 objects with this structure:
[
    {{
        "name": "Firstname Lastname",
        "role": "e.g., Senior iOS Engineer",
        "match_score": 95,
        "can_teach_you": ["skill1", "skill2"],
        "wants_to_learn_from_you": ["skill3"],
        "bio": "A short, engaging 1-2 sentence bio about what they are building or looking for."
    }}
]

Return ONLY valid JSON array."""

    fallback = [
        {
            "name": "Sarah Jenkins",
            "role": "Backend Engineer",
            "match_score": 92,
            "can_teach_you": [want.split(",")[0].strip() if want else "System Design"],
            "wants_to_learn_from_you": [have.split(",")[0].strip() if have else "Frontend Basics"],
            "bio": "Currently scaling APIs and would love to exchange knowledge on modern tech stacks."
        },
        {
            "name": "David Wu",
            "role": "Full Stack Developer",
            "match_score": 85,
            "can_teach_you": ["Architecture Patterns", "Cloud Deployment"],
            "wants_to_learn_from_you": [have.split(",")[0].strip() if have else "Interview Prep"],
            "bio": "Self-taught dev looking for a mock interview partner to practice system design."
        },
        {
            "name": "Priya Patel",
            "role": "Product Engineer",
            "match_score": 78,
            "can_teach_you": ["Agile delivery", "Product thinking"],
            "wants_to_learn_from_you": ["Technical deep dives"],
            "bio": "Transitioning to a more technical role. Happy to help with behavioral prep!"
        }
    ]

    result = call_llm_json(prompt, fallback)
    return jsonify({"success": True, "matches": result, "llm_used": LLM_AVAILABLE})


# ══════════════════════════════════════════════════════════
# RUN SERVER
# ══════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("\n" + "=" * 55)
    print("  INSIGNIA — AI Interview Preparation Suite")
    print("  Backend Server with Gemini LLM")
    print("=" * 55)
    print(f"  http://localhost:5000")
    print(f"  LLM Status: {'Connected' if LLM_AVAILABLE else 'Offline (using fallbacks)'}")
    print("=" * 55 + "\n")
    app.run(debug=True, port=5000)
