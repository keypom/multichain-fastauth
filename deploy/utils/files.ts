const fs = require("fs");
const path = require("path");

// Helper function to update the EXISTING_FACTORY in config.ts dynamically
export const updateConfigFile = (newContractId: string) => {
  const configFilePath = path.join(__dirname, "../config.ts");

  // Check if the config file exists
  if (!fs.existsSync(configFilePath)) {
    throw new Error(`Config file not found: ${configFilePath}`);
  }

  // Read the current content of the config file
  const configContent = fs.readFileSync(configFilePath, "utf-8");

  // Replace the EXISTING_CONTRACT_ID value
  const updatedContent = configContent.replace(
    /export const EXISTING_CONTRACT_ID = ".*?";/,
    `export const EXISTING_CONTRACT_ID = "${newContractId}";`,
  );

  // Check if replacement actually happened
  if (updatedContent === configContent) {
    throw new Error(
      "Failed to update EXISTING_CONTRACT_ID. Please check the regex or config file format.",
    );
  }

  // Write the updated content back to the correct config file
  fs.writeFileSync(configFilePath, updatedContent);
  console.log(`Updated config.ts with new contract ID: ${newContractId}`);
};
