import {
  TableOfContents,
  type TocItem,
} from "@/components/docs/table-of-contents";
import { Callout, CopyBlock, DetailBlock, P } from "@/components/typography";

const tocItems: TocItem[] = [
  { id: "shared-workstations", label: "Shared Workstations", level: 2 },
  { id: "publics", label: "Publics", level: 3 },
  { id: "canoes", label: "Canoes", level: 3 },
  { id: "uhero-nas", label: "UHEROnas", level: 3 },
  { id: "networking", label: "Networking", level: 2 },
  { id: "troubleshooting", label: "Troubleshooting", level: 3 },
];

export default function ITInfrastructurePage() {
  return (
    <div className="flex flex-1 gap-8 p-4 pt-0">
      <article className="max-w-3xl min-w-0 flex-1">
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100">
          IT Infrastructure
        </h1>
        <P>
          Reference documentation for shared workstationsand networking. This
          page covers the basic access details needed to connect to our shared
          resources. Check in on slack for more info or if you have trouble
          connecting.
        </P>

        <section className="mt-10">
          <h2
            id="shared-workstations"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Shared Workstations
          </h2>
          <P>
            UHERO maintains several shared workstations available to faculty,
            staff and research assistants. The primary purpose of these devices
            is to process large data sets stored on the NAS. Operating on large
            data sets from a remote network over the UH VPN can become very
            slow. Stop by my desk and I'll explain why or trust me and use
            these.
          </P>
          <h3
            id="publics"
            className="mt-8 scroll-mt-20 text-lg font-semibold text-stone-700 dark:text-stone-200"
          >
            Publics <span className="text-black/50">| MacMini</span>
          </h3>
          <div className="flex">
            <div className="mr-4 flex flex-col">
              <P className="inline-block">
                Publics is a MacMini that uses a shared login and supports 1
                user at a time. This is the quickest workstation to start using.
                It's configured for our most common data processing needs. Note
                that it also handles regularly scheduled daily and weekly tasks
                for udaman.
              </P>
              <Callout className="">
                Use MacOS built-in VNC client for remote desktop access.
              </Callout>
            </div>
            <DetailBlock
              className="inline-block"
              items={[
                { label: "Name", value: "Publics" },
                { label: "User", value: "uhero" },
                { label: "Pswd", value: "slack wood2@hawaii.edu" },
                { label: "IP", value: "128.171.200.209" },
                { label: "OS", value: "MacOS" },
                { label: "Specs", value: "24GB Ram, M2 CPU 8-cores" },
              ]}
            />
          </div>
          <h3
            id="canoes"
            className="mt-8 scroll-mt-20 text-lg font-semibold text-stone-700 dark:text-stone-200"
          >
            Canoes <span className="text-black/50">| Linux ThinkStation</span>
          </h3>
          <div className="flex">
            <div className="flex flex-col">
              <P className="inline-block">
                Device supports simultaneous users on different user accounts.
                Can connect remotely using Windows App, Remote Positron or VS
                Code session, or SSH. Linux does have it's quirks, but for
                executing R scripts, it should operate very much like you'd
                expect on Mac.
              </P>
              <Callout className="mr-4">
                Must use the{" "}
                <a
                  className="underline hover:text-black"
                  href="https://apps.apple.com/us/app/windows-app/id1295203466?mt=12"
                >
                  Windows App
                </a>{" "}
                for remote desktop (RDP)
              </Callout>
            </div>
            <DetailBlock
              className="inline-block"
              items={[
                { label: "Name", value: "Canoes" },
                { label: "User", value: "uhero, ruser, uh-id" },
                { label: "Pswd", value: "slack wood2@hawaii.edu" },
                { label: "IP", value: "128.171.200.210" },
                { label: "OS", value: "Linux - Ubuntu 24" },
                { label: "Specs", value: "64GB RAM, CPU 16 core, GPU" },
              ]}
            />
          </div>
          <P>
            Once you have a user account on the device, paste this into the
            terminal on your own device. It's a script to install an SSH key
            which allows you to open a Positron or VS Code session with no
            password.
          </P>
          <CopyBlock text="curl -fsSL https://uhero21.colo.hawaii.edu/misc/canoes-access.sh | bash">
            {`curl -fsSL https://uhero21.colo.hawaii.edu/misc/canoes-access.sh |
            bash`}
          </CopyBlock>
          <h3
            id="uhero-nas"
            className="mt-8 scroll-mt-20 text-lg font-semibold text-stone-700 dark:text-stone-200"
          >
            UHEROnas
          </h3>
          <div className="flex">
            <div className="mr-4 flex flex-col">
              <P className="inline-block">
                The "NAS" is a shared network drive. It is a computer, but think
                about it more as an external file storage. Mount it to your file
                system, or access it's simple OS in the browser. UHEROroot is
                the general, shared Volume. Work with Caleb in IT when adding
                substantial new data sets or configuring access to restricted
                data.
              </P>
            </div>
            <DetailBlock
              className="inline-block"
              items={[
                { label: "Name", value: "UHEROnas" },
                { label: "IP", value: "128.171.200.230" },
                { label: "OS", value: "Synology DSM" },
                { label: "Specs", value: "8GB RAM, 2 Core CPU" },
                { label: "Mount", value: "smb://128.171.200.230" },
                {
                  label: "Browser",
                  value: (
                    <a href={"http://128.171.200.230:5000"}>
                      {"http://128.171.200.230:5000"}
                    </a>
                  ),
                },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <h2
            id="Networking"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Networking
          </h2>
          <h3
            id="vpn-access"
            className="mt-8 scroll-mt-20 text-lg font-semibold text-stone-700 dark:text-stone-200"
          >
            VPN Access
          </h3>
          <P>
            UH VPN is required to access shared workstations and the NAS. This
            is a necessary security step to prevent direct access to sensitive
            data. See UH ITS documentation for configuring UH VPN on Mac or
            Windows.
          </P>
          <Callout>
            See UH ITS documentation for configuring UH VPN on Mac or Windows.
            <a
              href="https://www.hawaii.edu/its/banner/vpn/"
              className="font-semibold underline"
            >
              {` https://www.hawaii.edu/its/banner/vpn/`}
            </a>
          </Callout>
          <h3
            id="troubleshooting"
            className="mt-8 scroll-mt-20 text-lg font-semibold text-stone-700 dark:text-stone-200"
          >
            Troubleshooting
          </h3>
          <P>Common network issues and their resolutions:</P>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-600 dark:text-stone-300">
            <li>
              <strong>Cannot connect to NAS databases:</strong> The NAS conducts
              backups in the evening, some services may be unavailable during
              these times.
            </li>
            <li>
              <strong>Cannot connect to NAS in browser:</strong>
              {` Make sure you are entering http, not https. and include the port number ":5000".`}
            </li>
            <li>
              <strong>Slow connection:</strong> Check for{" "}
              <a href="https://www.hawaii.edu/its/alerts">UH outtages</a>.
              Inclement weather often causes poor network performance on campus.
            </li>
            <li>
              <strong>VPN won&apos;t connect:</strong> Ensure you do not have
              any conflicting VPN or network settings.
            </li>
          </ul>
          <P>When in doubt, slack or email wood2@hawaii.edu</P>
        </section>
      </article>

      {/* Table of Contents sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-20">
          <TableOfContents items={tocItems} />
        </div>
      </aside>
    </div>
  );
}
