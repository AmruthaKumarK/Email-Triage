"""Realistic email dataset for the OpenEnv Email Triage Environment."""
import random
from typing import List
from .models import Email


EMAIL_TEMPLATES = [
    # SALES emails
    {
        "subject": "Partnership opportunity with {company}",
        "sender": "alex.morgan@{domain}",
        "sender_domain": "{domain}",
        "body": "Hi,\n\nI'm reaching out on behalf of {company}. We offer enterprise software solutions that could save your team significant time. Our clients report 40% productivity gains on average.\n\nWould you be open to a 15-minute call this week?\n\nBest,\nAlex Morgan\nBusiness Development at {company}",
        "category": "sales",
        "priority": "low",
        "has_attachment": False,
        "requires_reply": False,
    },
    {
        "subject": "Q4 pricing proposal - ready for your review",
        "sender": "sales@{domain}",
        "sender_domain": "{domain}",
        "body": "Dear Team,\n\nAttached please find our updated Q4 pricing proposal for the enterprise license. We've included volume discounts based on your requirements and a 30-day pilot option.\n\nThis offer expires end of month. Please let us know if you'd like to schedule a review call.\n\nThank you for your consideration.",
        "category": "sales",
        "priority": "medium",
        "has_attachment": True,
        "requires_reply": True,
    },
    # SUPPORT emails
    {
        "subject": "Production outage - API returning 500 errors",
        "sender": "oncall@{domain}",
        "sender_domain": "{domain}",
        "body": "URGENT: Our production API has been returning 500 errors for the past 30 minutes. All customer-facing services are affected. Error logs show database connection pool exhaustion.\n\nCustomers are reporting inability to login. Revenue impact is approximately $50k/hour.\n\nNeed immediate escalation to engineering on-call team.",
        "category": "support",
        "priority": "critical",
        "has_attachment": False,
        "requires_reply": True,
    },
    {
        "subject": "Cannot export report to PDF",
        "sender": "user@{domain}",
        "sender_domain": "{domain}",
        "body": "Hi Support,\n\nI'm having trouble exporting my monthly report to PDF format. The export button seems to work but the file never downloads. I've tried in Chrome and Firefox.\n\nThis is blocking my end-of-month reporting. Can you help?\n\nThanks,\nJamie",
        "category": "support",
        "priority": "medium",
        "has_attachment": False,
        "requires_reply": True,
    },
    {
        "subject": "General question about billing cycle",
        "sender": "billing@{domain}",
        "sender_domain": "{domain}",
        "body": "Hello,\n\nI have a quick question about when my billing cycle resets each month. Could you confirm the exact date so I can plan our budget accordingly?\n\nThanks!",
        "category": "support",
        "priority": "low",
        "has_attachment": False,
        "requires_reply": True,
    },
    # LEGAL emails
    {
        "subject": "NDA required before technical disclosure",
        "sender": "legal@{domain}",
        "sender_domain": "{domain}",
        "body": "Dear Partners,\n\nBefore we can share the technical architecture details for the proposed integration, we need an executed NDA from your legal team.\n\nAttached is our standard NDA template. Please have it reviewed and returned signed by Friday EOD.\n\nThis is a hard requirement before any technical discussions can proceed.\n\nBest regards,\nLegal Team",
        "category": "legal",
        "priority": "high",
        "has_attachment": True,
        "requires_reply": True,
    },
    {
        "subject": "GDPR compliance audit - urgent documentation needed",
        "sender": "compliance@{domain}",
        "sender_domain": "{domain}",
        "body": "IMPORTANT: Our annual GDPR compliance audit is scheduled for next Tuesday. The auditors require the following documentation by Monday:\n\n1. Data processing records\n2. Privacy impact assessments\n3. Data retention policies\n4. Breach notification procedures\n\nFailure to provide these documents may result in regulatory penalties.\n\nPlease confirm receipt and expected submission timeline.",
        "category": "legal",
        "priority": "critical",
        "has_attachment": False,
        "requires_reply": True,
    },
    # HR emails
    {
        "subject": "Open enrollment deadline - action required by Friday",
        "sender": "hr@{domain}",
        "sender_domain": "{domain}",
        "body": "Hi,\n\nThis is a reminder that the benefits open enrollment period closes this Friday at 5pm ET.\n\nIf you don't make selections, you'll be auto-enrolled in the default plan which may not be optimal for your situation.\n\nPlease log into the HR portal to review and confirm your selections.\n\nHR Team",
        "category": "hr",
        "priority": "high",
        "has_attachment": False,
        "requires_reply": False,
    },
    {
        "subject": "Performance review cycle starting next week",
        "sender": "hr@{domain}",
        "sender_domain": "{domain}",
        "body": "Team,\n\nOur semi-annual performance review cycle begins next Monday. Please ensure you complete your self-assessment in Workday by March 15th.\n\nManagers should schedule 1:1 review meetings for the last week of March.\n\nDetailed instructions are in the HR wiki.\n\nThank you,\nPeople Operations",
        "category": "hr",
        "priority": "medium",
        "has_attachment": False,
        "requires_reply": False,
    },
    # EXECUTIVE emails
    {
        "subject": "Board meeting prep - deck review needed ASAP",
        "sender": "ceo@{domain}",
        "sender_domain": "{domain}",
        "body": "Team,\n\nThe Q4 board meeting is in 48 hours and I need everyone to review the attached deck and provide feedback by tonight.\n\nPay special attention to slides 8-12 (financial projections) and slide 23 (competitive landscape). The board will scrutinize these heavily.\n\nDo NOT share this externally - NDA applies.\n\n- Sarah",
        "category": "executive",
        "priority": "critical",
        "has_attachment": True,
        "requires_reply": True,
    },
    {
        "subject": "Strategic planning offsite - save the date",
        "sender": "exec-assistant@{domain}",
        "sender_domain": "{domain}",
        "body": "Please save March 15-17 for our annual strategic planning offsite at Napa Valley.\n\nFlight arrangements and hotel blocks will be coordinated by the executive assistant team. Please respond to confirm attendance by end of this week.\n\nAgenda will be shared two weeks prior.",
        "category": "executive",
        "priority": "medium",
        "has_attachment": False,
        "requires_reply": True,
    },
    # SPAM emails
    {
        "subject": "Congratulations! You've been selected for a $500 gift card",
        "sender": "noreply@prize-{domain}",
        "sender_domain": "prize-{domain}",
        "body": "CONGRATULATIONS! You've been randomly selected to receive a $500 Amazon gift card!\n\nClick here to claim your prize: http://claim-prize-now.xyz/gift500\n\nOffer expires in 24 hours. Act now!\n\n*This is not spam. You signed up for our newsletter at some point.*",
        "category": "spam",
        "priority": "low",
        "has_attachment": False,
        "requires_reply": False,
    },
    {
        "subject": "Make $5000/week from home - no experience needed!",
        "sender": "opportunities@{domain}",
        "sender_domain": "{domain}",
        "body": "Are you tired of your 9-5? We have a REVOLUTIONARY opportunity that allows ordinary people to make extraordinary income!\n\nNo experience needed. No investment required. Just 2 hours per day.\n\nJoin 50,000+ people already living their dream life!\n\nClick to learn more >>",
        "category": "spam",
        "priority": "low",
        "has_attachment": False,
        "requires_reply": False,
    },
    # NEWSLETTER emails
    {
        "subject": "This week in AI: GPT-5 rumors, Claude updates, and more",
        "sender": "newsletter@{domain}",
        "sender_domain": "{domain}",
        "body": "Welcome to your weekly AI digest!\n\n📰 TOP STORIES:\n• OpenAI rumored to release GPT-5 next quarter\n• Anthropic announces Claude 3.5 Sonnet improvements\n• Google DeepMind's new AlphaCode results published\n\n📊 THIS WEEK'S METRICS:\n• AI funding reached $18B in Q1 2025\n• Enterprise AI adoption at 67% of Fortune 500\n\nRead the full newsletter at our website.",
        "category": "newsletter",
        "priority": "low",
        "has_attachment": False,
        "requires_reply": False,
    },
    {
        "subject": "Product update: New features released this sprint",
        "sender": "product-updates@{domain}",
        "sender_domain": "{domain}",
        "body": "Hi there,\n\nWe've shipped some exciting new features this sprint:\n\n✅ Dark mode is now available in all views\n✅ CSV export for all reports\n✅ New keyboard shortcuts (press ? to see all)\n✅ Bulk operations on list views\n\nFull changelog: https://docs.example.com/changelog\n\nHave feedback? Reply to this email.\n\nThe Product Team",
        "category": "newsletter",
        "priority": "low",
        "has_attachment": False,
        "requires_reply": False,
    },
    # PERSONAL emails
    {
        "subject": "Lunch tomorrow?",
        "sender": "friend@{domain}",
        "sender_domain": "{domain}",
        "body": "Hey!\n\nAre you free for lunch tomorrow? I'm thinking tacos at 12:30pm. Let me know if that works!\n\nCheers",
        "category": "personal",
        "priority": "low",
        "has_attachment": False,
        "requires_reply": True,
    },
    {
        "subject": "Birthday dinner this Saturday",
        "sender": "family@{domain}",
        "sender_domain": "{domain}",
        "body": "Hi,\n\nJust a reminder that Dad's 60th birthday dinner is this Saturday at 7pm at La Maison restaurant.\n\nPlease let me know if you can make it. We have a reservation for 12 people.\n\nLove,\nMom",
        "category": "personal",
        "priority": "medium",
        "has_attachment": False,
        "requires_reply": True,
    },
    # Additional support - critical
    {
        "subject": "Security breach detected - immediate action required",
        "sender": "security@{domain}",
        "sender_domain": "{domain}",
        "body": "CRITICAL SECURITY ALERT\n\nOur security monitoring has detected unusual access patterns suggesting a potential data breach.\n\nAffected systems: Customer database, authentication service\nDetected at: 14:23 UTC\nSuspected vectors: Compromised credentials\n\nImmediate actions required:\n1. Rotate all service account credentials\n2. Enable enhanced logging\n3. Brief the incident response team\n4. Prepare breach notification if confirmed\n\nDo NOT discuss over unencrypted channels.",
        "category": "support",
        "priority": "critical",
        "has_attachment": False,
        "requires_reply": True,
    },
    # Executive - high priority
    {
        "subject": "Acquisition offer - strictly confidential",
        "sender": "cfo@{domain}",
        "sender_domain": "{domain}",
        "body": "STRICTLY CONFIDENTIAL - DO NOT FORWARD\n\nWe have received a preliminary acquisition offer from a strategic buyer at a significant premium to our current valuation.\n\nThe board has convened an emergency session for Thursday. All C-suite must attend.\n\nPlease confirm attendance immediately. Details will be shared verbally only.\n\nThis information is material and non-public.",
        "category": "executive",
        "priority": "critical",
        "has_attachment": False,
        "requires_reply": True,
    },
    # Sales - medium
    {
        "subject": "Your free trial is expiring in 3 days",
        "sender": "trials@{domain}",
        "sender_domain": "{domain}",
        "body": "Hi,\n\nYour 14-day free trial of our platform expires in 3 days.\n\nTo continue using all features, please upgrade to one of our paid plans.\n\nOur most popular plan starts at $49/month. Use code TRIAL20 for 20% off your first 3 months.\n\nHave questions? Reply to this email or book a call with our sales team.\n\nThe Trials Team",
        "category": "sales",
        "priority": "medium",
        "has_attachment": False,
        "requires_reply": False,
    },
]

DOMAINS = [
    "techcorp.com", "innovate.io", "enterprise.co", "startupco.com",
    "megacorp.net", "globaltech.com", "digitalhq.io", "cloudtech.co"
]

COMPANIES = [
    "TechVentures", "CloudScale", "DataSphere", "AIForward",
    "NextGen Solutions", "PlatformX", "ScaleOps", "FutureStack"
]


def generate_email_dataset(n: int = 20, seed: int = 42) -> List[Email]:
    """Generate a realistic email dataset."""
    rng = random.Random(seed)
    templates = EMAIL_TEMPLATES.copy()
    rng.shuffle(templates)

    emails = []
    used_ids = set()

    for i in range(min(n, len(templates))):
        tmpl = templates[i % len(templates)]
        domain = rng.choice(DOMAINS)
        company = rng.choice(COMPANIES)

        email_id = f"email_{i:03d}_{rng.randint(1000, 9999)}"
        while email_id in used_ids:
            email_id = f"email_{i:03d}_{rng.randint(1000, 9999)}"
        used_ids.add(email_id)

        # Format template fields
        def fmt(s):
            return s.replace("{domain}", domain).replace("{company}", company)

        import datetime
        hours_ago = rng.randint(0, 72)
        ts = (datetime.datetime.utcnow() - datetime.timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")

        email = Email(
            id=email_id,
            subject=fmt(tmpl["subject"]),
            sender=fmt(tmpl["sender"]),
            sender_domain=fmt(tmpl["sender_domain"]),
            body=fmt(tmpl["body"]),
            timestamp=ts,
            category=tmpl["category"],
            priority=tmpl["priority"],
            has_attachment=tmpl["has_attachment"],
            requires_reply=tmpl["requires_reply"],
            is_processed=False,
        )
        emails.append(email)

    return emails
