import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, ListChecks, Mic, Paperclip, Send } from "lucide-react";
import { NuraLogo, NuraMark } from "@/components/nura-logo";

/**
 * Local-only chat layout QA. Production returns 404.
 */
export default function ChatPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="chat-page">
      <header>
        <Link href="/today" className="icon-only-btn" aria-label="Back to Today">
          <ArrowLeft />
        </Link>
        <NuraLogo compact href="/today" />
        <div className="chat-header-actions">
          <Link href="/calendar" className="icon-only-btn" title="Calendar" aria-label="Calendar">
            <CalendarDays />
          </Link>
          <Link href="/plans" className="icon-only-btn" title="View Care plans" aria-label="View Care plans">
            <ListChecks />
          </Link>
        </div>
      </header>

      <section className="chat-layout">
        <div className="chat-main">
          <div className="messages">
            <div className="nura-message">
              <NuraMark size={30} />
              <div>
                <p>I&apos;m still here with you. Want to say a bit more about what&apos;s going on?</p>
              </div>
            </div>

            <div className="user-message">
              <p className="user-message-text">Are you not open to discuss further with me?</p>
            </div>

            <div className="nura-message">
              <NuraMark size={30} />
              <div>
                <p>Of course — I&apos;m here. Tell me a little more and I&apos;ll stay with you on it.</p>
              </div>
            </div>

            <div className="user-message">
              <p className="user-message-text">Ok</p>
            </div>

            <div className="nura-message">
              <NuraMark size={30} />
              <div>
                <p>Whenever you&apos;re ready, I&apos;m listening.</p>
              </div>
            </div>
          </div>

          <div className="chat-composer" aria-label="Message Nura">
            <label className="composer-file-button" aria-label="Attach file">
              <Paperclip />
              <input type="file" disabled />
            </label>
            <textarea placeholder="Message Nura…" rows={1} readOnly defaultValue="" />
            <button type="button" aria-label="Record a voice note">
              <Mic />
            </button>
            <button type="button" className="send-button" aria-label="Send">
              <Send />
            </button>
          </div>
        </div>

        <aside className="context-panel">
          <span className="auth-kicker">RELATED CONTEXT</span>
          <h2>No Care plan yet</h2>
          <p>Nura will connect what you share to a Care plan as the conversation continues.</p>
          <article>
            <FileText />
            <div>
              <b>Conversation-first memory</b>
              <span>Messages, context notes, and voice notes update Care plans.</span>
            </div>
          </article>
          <button type="button" className="primary-cta full">
            Connect WhatsApp
          </button>
          <Link href="/summary" className="secondary-cta full">
            View current summary
          </Link>
        </aside>
      </section>
    </main>
  );
}
