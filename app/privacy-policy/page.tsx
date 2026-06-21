import type { Metadata } from "next";
import LegalPage, {
  P,
  UL,
  LI,
  Callout,
  type LegalSection,
} from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Trashium",
  description:
    "How Trashium collects, uses, and protects your information. Written for an academic demo project — clear about what is real and what is not.",
};

const sections: LegalSection[] = [
  {
    id: "overview",
    heading: "Overview",
    body: (
      <>
        <P>
          This Privacy Policy explains what information Trashium handles when you
          use the platform to schedule recyclables pickups, earn Green Credits,
          and redeem rewards. We&apos;ve tried to write it in plain language
          rather than dense legalese.
        </P>
        <Callout>
          Trashium is a final-year B.Tech capstone project, not a registered
          commercial service. It runs in a demonstration capacity, and this
          policy describes how the prototype is designed to handle data — not the
          obligations of an incorporated company.
        </Callout>
      </>
    ),
  },
  {
    id: "data-we-collect",
    heading: "Information we collect",
    body: (
      <>
        <P>
          To run pickups and rewards, Trashium may collect the following:
        </P>
        <UL>
          <LI>
            <strong>Account data</strong> — your name, email, and the role your
            account is set to (household, collector, or admin).
          </LI>
          <LI>
            <strong>Contact details</strong> — phone number and email, used to
            confirm and coordinate pickups.
          </LI>
          <LI>
            <strong>Address &amp; location data</strong> — your pickup address
            and operational area (for example Rishra, Howrah, Shyamnagar,
            Tarakeswar, or Hugli-Chinsura), used to route crews and quote
            area-specific rates.
          </LI>
          <LI>
            <strong>Pickup details</strong> — the waste category, estimated and
            verified quantity, scheduled date, and status of each request.
          </LI>
          <LI>
            <strong>Rewards data</strong> — your Green Credits balance, eco-level,
            badges, streaks, and redemption history.
          </LI>
        </UL>
      </>
    ),
  },
  {
    id: "how-we-use",
    heading: "How we use your information",
    body: (
      <UL>
        <LI>Scheduling, confirming, and tracking doorstep pickups.</LI>
        <LI>
          Calculating fair, area-specific scrap rates and crediting your rewards
          after a pickup is verified.
        </LI>
        <LI>
          Letting collectors and admins manage routes, verify weights, and run
          day-to-day operations.
        </LI>
        <LI>
          Improving the service — understanding which areas and materials see the
          most activity.
        </LI>
        <LI>
          Basic fraud prevention — spotting misuse such as inflated quantities or
          duplicate reward claims.
        </LI>
        <LI>Communicating with you about your pickups and account.</LI>
      </UL>
    ),
  },
  {
    id: "sharing",
    heading: "When we share data",
    body: (
      <>
        <P>
          Trashium does not sell your data. Information is shared only with the
          people who need it to complete a pickup:
        </P>
        <UL>
          <LI>
            <strong>Collectors</strong> see the pickup details and address needed
            to reach your door.
          </LI>
          <LI>
            <strong>Admins</strong> can view operational data to manage routes,
            pricing, and rewards.
          </LI>
          <LI>
            <strong>Recycling partners</strong> receive aggregated material,
            not your personal account details, where relevant.
          </LI>
        </UL>
      </>
    ),
  },
  {
    id: "location",
    heading: "Location & map data",
    body: (
      <P>
        Pickup routing and the collector route map use approximate, area-level
        coordinates tied to your registered address and operational sector. The
        map view is rendered with Leaflet using open map tiles. Trashium does not
        track your live device location in the background; location is only used
        in the context of scheduling and completing a pickup.
      </P>
    ),
  },
  {
    id: "security",
    heading: "How we protect your data",
    body: (
      <UL>
        <LI>
          Authentication and session handling run through Supabase Auth, so your
          login is protected by an established provider rather than home-grown
          code.
        </LI>
        <LI>
          Role-based access keeps household, collector, and admin views separated,
          with admin functions gated behind the admin role.
        </LI>
        <LI>
          Data lives in a managed Postgres database with row-level security
          policies on its core tables.
        </LI>
        <LI>Access to operational data is limited to the roles that need it.</LI>
      </UL>
    ),
  },
  {
    id: "your-rights",
    heading: "Your choices and rights",
    body: (
      <>
        <P>You can:</P>
        <UL>
          <LI>Access the account and pickup information held about you.</LI>
          <LI>Ask us to correct details that are wrong or out of date.</LI>
          <LI>Request deletion of your account data.</LI>
        </UL>
        <P>
          Because this is a demo project, please send these requests to the
          project team and allow a little time for us to action them manually.
        </P>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <P>
        As the project evolves, this policy may change. We&apos;ll update the date
        at the top of the page when it does. Significant changes will be reflected
        directly here rather than sent as notifications.
      </P>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="June 2026"
      intro="What information Trashium handles when you schedule pickups and earn rewards, how it's used, and the choices you have. Written for a student-built demonstration project."
      sections={sections}
    />
  );
}
