import { useState, useRef } from "react";
import {
  MessageCircle,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Package,
  RotateCcw,
  CreditCard,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Button } from "../../components/Button";
import api from "../../../services/api";

interface FAQ {
  q: string;
  a: string;
  topic: string;
}

const FAQS: FAQ[] = [
  {
    topic: "Orders",
    q: "How do I track my order?",
    a: "Go to Account → My Orders to see real-time status updates for all your orders. You'll also receive email notifications at each stage.",
  },
  {
    topic: "Orders",
    q: "Can I cancel or modify my order?",
    a: "Orders can be cancelled within 1 hour of placement. After that, please contact support. Modifications are not supported once the order is confirmed.",
  },
  {
    topic: "Returns & Refunds",
    q: "What is the return policy?",
    a: "We offer a 30-day hassle-free return policy. Items must be unused, in original packaging, and accompanied by proof of purchase.",
  },
  {
    topic: "Returns & Refunds",
    q: "How long does a refund take?",
    a: "Refunds are processed within 2–3 business days of receiving the returned item. The amount reflects in your account in 5–7 business days depending on your bank.",
  },
  {
    topic: "Payments",
    q: "Is my payment information secure?",
    a: "Yes. All payments are processed through Stripe with 256-bit SSL encryption. We never store your card details on our servers.",
  },
  {
    topic: "Shipping",
    q: "Do you offer free shipping?",
    a: "Yes! Orders above $50 qualify for free standard shipping. Express and overnight options are available at an additional cost.",
  },
  {
    topic: "Orders",
    q: "How do I change my delivery address?",
    a: "Go to Account → My Addresses to add, edit, or set a default address before placing an order.",
  },
  {
    topic: "Payments",
    q: "What payment methods do you accept?",
    a: "We accept all major credit/debit cards (Visa, Mastercard, Amex), and digital wallets supported by Stripe.",
  },
];

const TOPICS = [
  { icon: Package, label: "Orders", color: "text-blue-500 bg-blue-50" },
  { icon: RotateCcw, label: "Returns & Refunds", color: "text-orange-500 bg-orange-50" },
  { icon: Truck, label: "Shipping", color: "text-green-500 bg-green-50" },
  { icon: CreditCard, label: "Payments", color: "text-purple-500 bg-purple-50" },
  { icon: ShieldCheck, label: "Account & Security", color: "text-teal-500 bg-teal-50" },
  { icon: MessageCircle, label: "General Enquiry", color: "text-pink-500 bg-pink-50" },
];

export default function HelpSupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  const handleTopicClick = (label: string) => {
    const next = activeTopic === label ? null : label;
    setActiveTopic(next);
    setOpenFaq(null);
    if (next) {
      setContactForm((f) => ({ ...f, subject: next + " Enquiry" }));
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.subject.trim() || !contactForm.message.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post("/support", contactForm);
      setSubmitted(true);
      setContactForm({ subject: "", message: "" });
    } catch {
      setError("Failed to send message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-2">
      <div>
        <h2 className="text-xl font-bold text-foreground">Help & Support</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Find answers to common questions or get in touch with our team.
        </p>
      </div>

      {/* Quick links */}
      <div>
        <p className="text-sm font-semibold mb-3">Browse by Topic</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TOPICS.map(({ icon: Icon, label, color }) => (
            <button
              key={label}
              onClick={() => handleTopicClick(label)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                activeTopic === label
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/40 hover:bg-slate-50"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">
            {activeTopic ? `FAQs: ${activeTopic}` : "Frequently Asked Questions"}
          </p>
          {activeTopic && (
            <button
              onClick={() => setActiveTopic(null)}
              className="text-xs text-primary hover:underline"
            >
              Show all
            </button>
          )}
        </div>
        <div className="space-y-2">
          {FAQS.filter((faq) => !activeTopic || faq.topic === activeTopic).map((faq, i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="text-sm font-medium pr-4">{faq.q}</span>
                {openFaq === i ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
              {openFaq === i && (
                <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-border pt-3 bg-slate-50/50">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div ref={formRef} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contact info */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Contact Us</p>
          <a
            href="mailto:advitiyaranjan1@gmail.com"
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-slate-50 transition-all group"
          >
            <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold group-hover:text-primary transition-colors">Email Support</p>
              <p className="text-xs text-muted-foreground">advitiyaranjan1@gmail.com</p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
          </a>
          <a
            href="tel:+919430435643"
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-slate-50 transition-all group"
          >
            <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold group-hover:text-primary transition-colors">Phone Support</p>
              <p className="text-xs text-muted-foreground">+91 94304 35643</p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
          </a>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
            <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold">Live Chat</p>
              <p className="text-xs text-muted-foreground">Available 24/7</p>
              <p className="text-xs text-green-600 font-medium">● Online now</p>
            </div>
          </div>
        </div>

        {/* Contact form */}
        <div>
          <p className="text-sm font-semibold mb-3">Send a Message</p>
          {submitted ? (
            <div className="flex flex-col items-center justify-center h-40 text-center space-y-2 bg-green-50 border border-green-200 rounded-xl p-4">
              <span className="text-2xl">✅</span>
              <p className="text-sm font-semibold text-green-700">Message sent!</p>
              <p className="text-xs text-green-600">We'll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Subject"
                value={contactForm.subject}
                onChange={(e) => setContactForm((f) => ({ ...f, subject: e.target.value }))}
              />
              <textarea
                rows={4}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                placeholder="Describe your issue…"
                value={contactForm.message}
                onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!contactForm.subject.trim() || !contactForm.message.trim() || submitting}
              >
                {submitting ? "Sending…" : "Send Message"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
