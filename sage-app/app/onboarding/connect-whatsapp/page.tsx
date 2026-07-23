import { CalendarClock, LockKeyhole, MessageCircle, Phone, PhoneCall, ShieldCheck } from "lucide-react";
import { OnboardingShell, PrivacyNote, SageMark } from "../components";

function WhatsAppMark() {
  return <span className="ob-whatsapp-mark" aria-hidden="true"><MessageCircle className="ob-whatsapp-bubble"/><Phone className="ob-whatsapp-phone"/></span>;
}

function WhyWhatsApp() {
  const items = [
    [MessageCircle, "A channel you already use", "No new app to open or remember."],
    [PhoneCall, "Text or voice", "Sage can message you or call you when it’s time."],
    [CalendarClock, "Right time, not too much", "You choose when and how often Sage checks in."],
    [LockKeyhole, "You stay in control", "Change your preferences or disconnect anytime."],
  ] as const;
  return <div><div className="ob-plan-icon"><MessageCircle size={21}/></div><h3>Why WhatsApp?</h3><div className="ob-why-list">{items.map(([Icon,title,desc])=><div className="ob-why" key={title}><i><Icon size={17}/></i><div><b>{title}</b><span>{desc}</span></div></div>)}</div><PrivacyNote>Your number is encrypted and used only to deliver your Sage check-ins. We never share it.</PrivacyNote></div>;
}

export default function ConnectWhatsAppPage() {
  return (
    <OnboardingShell active={4} backHref="/onboarding/tell-sage" nextHref="/onboarding/plan" aside={<WhyWhatsApp />}>
      <div className="ob-kicker">STEP 4 OF 6</div>
      <h1 className="ob-title">Let Sage check in<br/>where you already are.</h1>
      <p className="ob-subtitle">Sage uses WhatsApp to send your check-ins, reminders and voice messages at the times you choose.</p>
      <div className="ob-whatsapp-visual">
        <div className="ob-wa-logo"><WhatsAppMark/></div>
        <div className="ob-wa-phone">
          <div className="ob-wa-head"><span className="ob-wa-avatar"><SageMark/></span><div><b>Sage</b><div style={{fontSize:8,color:'#849087'}}>Online</div></div></div>
          <div className="ob-wa-bubble">Hi Ike! 👋<br/>Time for your check-in.</div>
          <div className="ob-wa-bubble white">How are you feeling today?</div>
          <button className="ob-wa-quick">Doing okay</button><button className="ob-wa-quick">A bit heavy</button><button className="ob-wa-quick">Not great</button>
        </div>
      </div>
      <div className="ob-phone-field"><label>Your WhatsApp number</label><div className="ob-phone-input"><div className="ob-country">🇬🇧 <b>+44</b>⌄</div><div className="ob-number">7123 456789</div></div></div>
      <button className="ob-primary ob-wide" type="button" style={{marginTop:12}}><MessageCircle size={17}/>Connect WhatsApp →</button>
      <div className="ob-or">or</div>
      <button className="ob-secondary ob-wide" type="button">I’ll do this later</button>
    </OnboardingShell>
  );
}