"""Canonical initial content for the Wagtail join page tree."""

LANDING = {
    "title": "Join",
    "slug": "join",
    "hero_eyebrow": "So you want to be a journalist?",
    "hero_heading": "Join The Ubyssey",
    "introduction": (
        "<p>Whether you want to report, make visuals, build products or learn "
        "how a newsroom works, there is a place for you here.</p>"
    ),
    "reportage_description": (
        "Reportage is comprised of the News, Opinion, Arts, Culture and Sports "
        "sections, which write and research stories. It also houses the Copy "
        "Department, which reviews stories' accuracy and prose in the final "
        "stages of editing."
    ),
    "visuals_description": (
        "Visuals brings The Ubyssey's journalism to life through photography, "
        "illustration, video and print and digital design."
    ),
    "product_description": (
        "Product connects our journalism with its audience through newsletters, "
        "social media, audio and the systems that power our newsroom."
    ),
    "application_process_heading": "Application Process",
    "application_process_introduction": (
        "Our application process takes about three weeks, from the time we post "
        "roles to when we onboard new hires."
    ),
    "faq_heading": "Frequently Asked Questions about the CJP",
    "career_heading": "Growing with The Ubyssey",
    "career_introduction": (
        "Starting as a staff contributor, members can grow into editing, "
        "department leadership and senior masthead roles."
    ),
}

APPLICATION_STEPS = [
    {
        "title": "Attend an Information Session",
        "description": (
            "Applicants all register to attend an information session that goes "
            "over an introduction to journalism and what it’s like to volunteer "
            "for The Ubyssey."
        ),
    },
    {
        "title": "Complete Your Application",
        "description": (
            "After the information session, we send all applicants the unique "
            "application for the roles they’re interested in. Part of the "
            "application includes a practice assignment, which will give you a "
            "chance to demonstrate your skills. Applications are open for one "
            "week from when they were sent."
        ),
    },
    {
        "title": "Interview and Decision",
        "description": (
            "After you complete your application, we may invite you for a brief "
            "interview. We’ll make decisions shortly after all interviews are "
            "completed."
        ),
    },
]

FAQS = [
    {
        "question": "When do applications open?",
        "answer": (
            "<p>Applications open throughout the year as individual teams need "
            "new contributors.</p>"
        ),
    },
    {
        "question": "Do all sections always take applications?",
        "answer": (
            "<p>No. Each unit manages its own capacity, so availability can "
            "change independently.</p>"
        ),
    },
    {
        "question": "Do I need previous journalism experience?",
        "answer": (
            "<p>No. Curiosity, care and a willingness to learn are the most "
            "important starting points.</p>"
        ),
    },
    {
        "question": "Can I contribute to more than one unit?",
        "answer": (
            "<p>Yes. Many contributors work across sections and develop more "
            "than one specialization.</p>"
        ),
    },
    {
        "question": "What happens after I apply?",
        "answer": (
            "<p>The relevant editor will review your application and contact "
            "you about next steps.</p>"
        ),
    },
]

CAREER_STAGES = [
    {
        "title": "Staff",
        "subtitle": "Reporters, Photojournalists, Illustrators, Designers",
    },
    {
        "title": "Deputy Department Heads",
        "subtitle": "Deputy Editors",
    },
    {
        "title": "Department Heads",
        "subtitle": "Editors, Senior Designers",
    },
    {
        "title": "Assistant Managing Editors",
        "subtitle": "Cross-Divisional Coordination",
    },
    {
        "title": "Senior Masthead",
        "subtitle": "Editor-in-Chief, Managing Editor",
    },
]

CAREER_DESCRIPTION = (
    "Develop newsroom skills, take on greater responsibility and help other "
    "contributors produce ambitious student journalism."
)

UNIT_SPECS = [
    ("News", "news", "reportage", "Section", [
        "AMS Reporter",
        "Governance Reporter",
        "Community Reporter",
        "Immigration Reporter",
        "Research Policy Reporter",
        "Economy Reporter",
        "Law Reporter",
        "Post-Secondary Policy Reporter",
        "Housing Reporter",
        "Transportation Reporter",
        "Health Reporter",
        "Climate Reporter",
    ]),
    ("Opinion", "opinion", "reportage", "Section", [
        "AMS Columnist",
        "Politics Columnist",
        "Entertainment Columnist",
        "Technology Columnist",
        "Local History Columnist",
    ]),
    ("Arts", "arts", "reportage", "Section", [
        "Music Critic",
        "Theatre Critic",
        "Film Critic",
        "Visual Art Critic",
        "Architecture Critic",
    ]),
    ("Culture", "culture", "reportage", "Section", [
        "Food Critic",
        "Book Critic",
        "Lifestyle Reporter",
        "Fashion Critic",
    ]),
    ("Sports", "sports", "reportage", "Section", [
        "Men's Soccer Reporter",
        "Women's Soccer Reporter",
        "Men's Basketball Reporter",
        "Women's Basketball Reporter",
        "Men's Volleyball Reporter",
        "Women's Volleyball Reporter",
        "Men's Hockey Reporter",
        "Women's Hockey Reporter",
        "Football Reporter",
        "Women's Rugby Reporter",
    ]),
    ("Copy", "copy", "reportage", "Department", [
        "Copy Editor",
    ]),
    ("Graphics", "graphics", "visuals", "Department", [
        "Opinion Illustrator",
        "Opinion Collagist",
        "Arts & Culture Illustrator",
        "Sports Collagist",
        "News Collagist",
    ]),
    ("Video", "video", "visuals", "Department", [
        "Arts & Culture Videographer",
        "Sports Videographer",
        "Sports Videographer",
        "News & Opinion Videographer",
    ]),
    ("Photography", "photography", "visuals", "Department", [
        "Arts Photojournalist",
        "Arts Photojournalist",
        "Culture Photojournalist",
        "Sports Photojournalist",
        "News & Opinion Photojournalist",
    ]),
    ("Print", "print", "visuals", "Department", [
        "News Page Designer",
        "Sports Page Designer",
        "Arts Page Designer",
        "Culture Page Designer",
        "News & Opinion Page Designer",
    ]),
    ("Digital", "digital", "visuals", "Department", [
        "Digital Designer, Sports",
        "Digital Designer, Arts & Culture",
        "Digital Designer, News & Opinion",
    ]),
    ("Audience", "audience", "product", "Department", [
        "Newsletter Assistant",
        "Socials Assistant",
    ]),
    ("Audio", "audio", "product", "Department", [
        "Audio Assistant",
    ]),
    ("Systems", "systems", "product", "Department", [
        "Editorial Developer",
    ]),
]

OPEN_POSITIONS = {
    ("news", 0),
    ("sports", 0),
    ("graphics", 0),
}


def unit_data():
    """Return the canonical unit dictionaries in their intended page order."""
    units = []
    for title, slug, category, unit_type, position_titles in UNIT_SPECS:
        units.append(
            {
                "title": title,
                "slug": slug,
                "category": category,
                "unit_type": unit_type,
                "card_description": (
                    f"Learn, collaborate and contribute to The Ubyssey's "
                    f"{title} team."
                ),
                "introduction": (
                    f"<p>The {title} team gives students practical experience "
                    "while producing independent journalism for the UBC "
                    "community.</p>"
                ),
                "unit_email": f"{slug}@ubyssey.ca",
                "contact_role": f"{title} Editor",
                "contact_name": "Editor Name",
                "contact_email": f"{slug}@ubyssey.ca",
                "positions": [
                    {
                        "title": position_title,
                        "description": (
                            f"<p>Contribute to the {title} team in this role. "
                            "Editors provide training, feedback and support "
                            "throughout the process.</p>"
                        ),
                        "accepting_applications": (slug, index) in OPEN_POSITIONS,
                    }
                    for index, position_title in enumerate(position_titles)
                ],
            }
        )
    return units
