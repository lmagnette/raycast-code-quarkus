import fetch from "node-fetch";
import { Action, ActionPanel, Form, popToRoot, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import path from "path";
import { writeFileSync } from "fs";
import { QuarkusVersion } from "./models/QuarkusVersion";
import { Configuration } from "./models/Configuration";
import { Dependency } from "./models/Dependency";
import { getCodeQuarkusUrl, getParams } from "./utils";
import { showInFinder } from "@raycast/api";

export function Dependencies({ version, configuration }: { version: QuarkusVersion; configuration: Configuration }) {
  const [isLoading, setIsLoading] = useState(true);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);

  async function fetchDependencies() {
    try {
      setIsLoading(true);
      console.log("Fetching dependencies...");
      //const response = {ok:false, status:'', statusText:'',json: () => Promise.resolve([])};
      const response = await fetch(
        `https://code.quarkus.io/api/extensions/stream/${version.key}?platformOnly=false`,
        {},
      );

      console.log("Response status:", response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch Quarkus dependencies: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as Dependency[];
      console.log("Metadata received successfully");

      setDependencies(data);
      setIsLoading(false);

      await showToast({
        style: Toast.Style.Success,
        title: "Success",
        message: "Metadata loaded successfully",
      });
    } catch (error) {
      console.error("Error fetching metadata:", error);
      setIsLoading(false);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to load metadata",
      });
    }
  }

  function generateQuarkusUrl(config: Configuration): string {
    const baseUrl = "https://code.quarkus.io/d";
    const params = getParams(config);
    return `${baseUrl}?${params.toString()}`;
  }

  async function handleSubmit() {
    try {
      console.log("Submitting form with values:", configuration);
      const url = generateQuarkusUrl(configuration);
      await showToast({ title: "Submitted form", message: "See logs for submitted values" });

      // Show generating toast
      await showToast({
        style: Toast.Style.Animated,
        title: "Generating project...",
      });

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to generate project: ${response.statusText}`);
      }

      // Convert the response to a buffer
      const buffer = await response.buffer();

      // Save to Downloads folder (macOS)
      const homeDir = process.env.HOME;
      const downloadsPath = path.join(homeDir || "", "Downloads", `${configuration.artifact}.zip`);

      writeFileSync(downloadsPath, buffer);
      await showInFinder(downloadsPath);
      await popToRoot();

      await showToast({
        style: Toast.Style.Success,
        title: "Project Downloaded",
        message: `Saved to Downloads folder as ${configuration.artifact}.zip`,
      });
    } catch (error) {
      console.error("Error generating project:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to generate project",
      });
    }
  }

  function setConfigDependencies(deps: string[]) {
    configuration.dependencies = deps;
  }


  function getUrl(){
    return getCodeQuarkusUrl(configuration);
  }

  useEffect(() => {
    fetchDependencies();
  }, []);

  if (isLoading) {
    return (
      <Form>
        <Form.Description text="Loading Code.Quarkus metadata... Please wait." />
      </Form>
    );
  }

  if (!dependencies) {
    return (
      <Form>
        <Form.Description text="Failed to load dependencies. Please try again." />
        <ActionPanel>
          <Action
            title="Retry"
            onAction={() => {
              fetchDependencies();
            }}
          />
        </ActionPanel>
      </Form>
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={handleSubmit} title="Generate Project" />
          <Action.OpenInBrowser url={getUrl()} />
          <Action.CopyToClipboard
            title="Copy Quarkus Configuration"
            content={getUrl()}
          />
        </ActionPanel>

      }
      navigationTitle={"Add dependencies to your new Quarkus project"}
    >
      <Form.Description title="Quarkus version" text={version?.platformVersion + (version?.lts ? " [LTS]" : "")} />
      <Form.Description title="Build tool" text={configuration.buildTool} />
      <Form.Description title="Group" text={configuration.group} />
      <Form.Description title="Artifact" text={configuration.artifact} />
      <Form.Description title="Version" text={configuration.version} />
      <Form.Description title="Java version" text={configuration.javaVersion} />
      <Form.Description title="Sarter Code" text={configuration.starterCode ? "Yes" : "No"} />
      <Form.Separator />
      <Form.TagPicker id="dependencies" title="Dependencies" onChange={setConfigDependencies}>
        {dependencies.map((dep) => (
          <Form.TagPicker.Item
            key={dep.id + ":" + dep.order}
            value={dep.id}
            title={dep.name + " [" + dep.id.split(":")[1] + "]"}
          />
        ))}
      </Form.TagPicker>
    </Form>
  );
}
