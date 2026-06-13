// Initial supported colleges. Seeded with `npm run seed:colleges` (idempotent: upserts by slug and never
// overwrites edits an admin made later). Admins manage the live list from the dashboard.
module.exports = [
  { slug: "iiitm-gwalior", name: "ABV-IIITM Gwalior", city: "Gwalior", state: "Madhya Pradesh", emailDomains: ["iiitm.ac.in"] },
  { slug: "iit-delhi", name: "IIT Delhi", city: "New Delhi", state: "Delhi", emailDomains: ["iitd.ac.in"] },
  { slug: "iit-bombay", name: "IIT Bombay", city: "Mumbai", state: "Maharashtra", emailDomains: ["iitb.ac.in"] },
  { slug: "iit-kanpur", name: "IIT Kanpur", city: "Kanpur", state: "Uttar Pradesh", emailDomains: ["iitk.ac.in"] },
  { slug: "iit-madras", name: "IIT Madras", city: "Chennai", state: "Tamil Nadu", emailDomains: ["iitm.ac.in"] },
  { slug: "iiit-hyderabad", name: "IIIT Hyderabad", city: "Hyderabad", state: "Telangana", emailDomains: ["iiit.ac.in"] },
  { slug: "iiit-allahabad", name: "IIIT Allahabad", city: "Prayagraj", state: "Uttar Pradesh", emailDomains: ["iiita.ac.in"] },
  { slug: "nit-trichy", name: "NIT Tiruchirappalli", city: "Tiruchirappalli", state: "Tamil Nadu", emailDomains: ["nitt.edu"] },
  { slug: "manit-bhopal", name: "MANIT Bhopal", city: "Bhopal", state: "Madhya Pradesh", emailDomains: ["manit.ac.in"] },
  { slug: "jiwaji-university", name: "Jiwaji University", city: "Gwalior", state: "Madhya Pradesh", emailDomains: [] },
  { slug: "mits-gwalior", name: "Madhav Institute of Technology & Science", city: "Gwalior", state: "Madhya Pradesh", emailDomains: ["mitsgwalior.in"] },
  { slug: "dtu-delhi", name: "Delhi Technological University", city: "New Delhi", state: "Delhi", emailDomains: ["dtu.ac.in"] },
];
