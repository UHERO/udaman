import {
  TableOfContents,
  type TocItem,
} from "@/components/docs/table-of-contents";
import {
  Callout,
  CodeBlock,
  CopyBlock,
  DetailBlock,
  P,
} from "@/components/typography";

const tocItems: TocItem[] = [
  { id: "shared-workstations", label: "Shared Workstations", level: 2 },
  { id: "macmini", label: "MacMini", level: 3 },
  { id: "canoes", label: "Canoes", level: 3 },
  { id: "uhero-nas", label: "UHEROnas", level: 3 },
  { id: "networking", label: "Networking", level: 2 },
  { id: "network-topology", label: "Network Topology", level: 3 },
  { id: "wifi", label: "Wi-Fi", level: 3 },
  { id: "vpn-access", label: "VPN Access", level: 3 },
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
          Reference documentation for shared hardware, networking, and systems
          administration. This page covers the physical and network
          infrastructure supporting UHERO operations.
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
            is to process large data sets stored on the NAS. It will be much
            faster to remote into one of these devices to run a script on a
            large data set stored on the NAS than it will be to connect to the
            NAS using the UH VPN on your home network and running the script
            from your own computer. Stop by my desk and I'll explain why! Or
            trust be and use these anytime your source data file gets larger
            than a few GB.
          </P>
          <h3
            id="macmini"
            className="mt-8 scroll-mt-20 text-lg font-semibold text-stone-700 dark:text-stone-200"
          >
            MacMini
          </h3>
          <div className="flex">
            <div className="mr-4 flex flex-col">
              <P className="inline-block">
                MacMini uses a shared login and supports 1 user at a time. This
                is the quickest workstation to start using. It's configured for
                our most common data processing needs. Note that it also handles
                regularly scheduled daily and weekly tasks for udaman.
              </P>
              <Callout className="">
                Use MacOS built-in VNC client for remote desktop access.
              </Callout>
            </div>
            <DetailBlock
              className="inline-block"
              items={[
                { label: "Name", value: "MacMiniProc" },
                { label: "User", value: "uhero" },
                { label: "Pswd", value: "email wood2@hawaii.edu" },
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
            Canoes
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
                { label: "Pswd", value: "email wood2@hawaii.edu" },
                { label: "IP", value: "128.171.200.210" },
                { label: "OS", value: "Linux - Ubuntu 24" },
                { label: "Specs", value: "64GB RAM, CPU 16 core, GPU" },
              ]}
            />
          </div>
          <P>
            Once you have a user account on the device, copy and paste this into
            the terminal on your own device to install an SSH key. This will
            allow you to open a Positron or VS Code session with no password.
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
                about it more as an external drive. Mount it to your file
                system, or access it's simple OS in the browser. UHEROroot is
                the general, shared Volume. Work with Caleb in IT when adding
                substantial new data sets or configuring access to restricted
                data.
              </P>
              <Callout className="">
                Use MacOS built-in VNC client for remote desktop access. Can
                also use the Windows App on Mac.
              </Callout>
            </div>
            <DetailBlock
              className="inline-block"
              items={[
                { label: "Name", value: "UHEROnas" },
                { label: "IP", value: "128.171.200.209" },
                { label: "OS", value: "Synology DSM" },
                { label: "Specs", value: "8GB RAM, 2 Core CPU" },
                { label: "Mount", value: "smb://128.171.200.230" },
                { label: "Browser", value: "http://128.171.200.230:5000" },
              ]}
            />
          </div>
        </section>

        {/* ── Networking ─────────────────────────────────────── */}
        <section className="mt-14">
          <h2
            id="networking"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Networking
          </h2>
          <P>
            The office network provides wired and wireless connectivity for all
            staff, research assistants, and visitors. This section covers the
            network layout, connection details, and common troubleshooting
            steps.
          </P>

          <h3
            id="network-topology"
            className="mt-8 scroll-mt-20 text-lg font-semibold text-stone-700 dark:text-stone-200"
          >
            Network Topology
          </h3>
          <P>
            The office runs a standard hub-and-spoke topology. The main switch
            connects to the university backbone and distributes connectivity to
            floor switches in each room. Wired connections are available at
            every desk and provide gigabit ethernet.
          </P>
          <P>
            VLANs are used to segment traffic between staff devices, servers,
            and the guest network. The server VLAN is isolated and accessible
            only from authorized workstations.
          </P>
          <CodeBlock>
            {`# Check your current IP and network interface\nip addr show\n\n# Test connectivity to the gateway\nping -c 4 10.0.0.1`}
          </CodeBlock>

          <h3
            id="wifi"
            className="mt-8 scroll-mt-20 text-lg font-semibold text-stone-700 dark:text-stone-200"
          >
            Wi-Fi
          </h3>
          <P>
            Two wireless networks are available in the office. The primary staff
            network uses WPA3-Enterprise authentication tied to your network
            credentials. A separate guest network is available for visitors with
            limited access.
          </P>
          <P>
            Connect to the staff network using your standard username and
            password. If prompted for a certificate, accept the university root
            CA.
          </P>
          <CopyBlock text="eduroam">eduroam</CopyBlock>
          <Callout>
            The guest network does not have access to internal resources such as
            file servers or printers. Use the staff network for all work-related
            tasks.
          </Callout>

          <h3
            id="vpn-access"
            className="mt-8 scroll-mt-20 text-lg font-semibold text-stone-700 dark:text-stone-200"
          >
            VPN Access
          </h3>
          <P>
            Remote access to internal resources requires a VPN connection. The
            university provides a GlobalProtect VPN client. Connect to the VPN
            before attempting to access internal servers, databases, or file
            shares from off-campus.
          </P>
          <CodeBlock>
            {`# Connect via CLI (macOS/Linux)\nglobalprotect connect --portal vpn.hawaii.edu`}
          </CodeBlock>
          <P>
            VPN sessions time out after 12 hours of inactivity. If your
            connection drops, simply reconnect using the same credentials.
          </P>

          <h3
            id="troubleshooting"
            className="mt-8 scroll-mt-20 text-lg font-semibold text-stone-700 dark:text-stone-200"
          >
            Troubleshooting
          </h3>
          <P>Common network issues and their resolutions:</P>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-600 dark:text-stone-300">
            <li>
              <strong>Cannot connect to Wi-Fi:</strong> Verify your credentials
              are current. Try forgetting the network and reconnecting. If using
              eduroam, ensure you are selecting the correct EAP method (PEAP).
            </li>
            <li>
              <strong>Slow connection:</strong> Check if you are on the guest
              network (bandwidth-limited). Switch to the staff network. If
              wired, try a different ethernet port.
            </li>
            <li>
              <strong>Cannot reach internal servers:</strong> Confirm you are on
              the staff VLAN or connected via VPN. Run a traceroute to identify
              where the connection drops.
            </li>
            <li>
              <strong>VPN won&apos;t connect:</strong> Ensure GlobalProtect is
              updated to the latest version. Check that you are not on a
              restricted network that blocks VPN traffic.
            </li>
          </ul>
          <CopyBlock text="traceroute 10.0.0.1">traceroute 10.0.0.1</CopyBlock>
          <P>
            For issues not resolved by these steps, contact IT with your
            hostname, IP address, and a description of the problem.
          </P>
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
