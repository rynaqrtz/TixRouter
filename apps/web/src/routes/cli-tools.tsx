import { createFileRoute } from "@tanstack/react-router";
import { CLIToolsCard } from "@/components/cli/CLIToolsCard";

export const Route = createFileRoute("/cli-tools")({
    staticData: { title: "CLI Tools" },
    component: CLIToolsPage
});

function CLIToolsPage() {
    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            <CLIToolsCard />
        </div>
    );
}
