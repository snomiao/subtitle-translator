#!/usr/bin/env bun

import yargs from "yargs";
import subtitleTranslator from ".";
await yargs(process.argv.slice(2))
  .command(
    "$0 <input..>",
    "Translate subtitles",
    (yargs) =>
      yargs
        .positional("input", {
          describe: "Input files, glob, e.g. *.srt",
          type: "string",
          default: "./*.{srt,vtt}",
          demandOption: true,
          array: true,
        })
        .option("outdir", {
          describe: "Output dir, will be 'translated-[Language]' if not set",
          alias: "o",
          type: "string",
        })
        .option("reference", {
          alias: "r",
          type: "string",
          description:
            "Reference infomation to use for translation, e.g. 'reference.txt'",
        })
        .option("language", {
          alias: "l",
          type: "string",
          default: "English",
          description:
            "Target language to translate to, e.g. 'English', 'French', 'Chinese Simplified', 'Chinese Traditional', 'Japanese', 'Korean', 'Spanish', 'French', 'German', 'Italian', 'Russian', 'Portuguese', 'Arabic', 'Turkish', 'Thai', 'Vietnamese', 'Indonesian', 'Malay', 'Filipino', 'Hindi', 'Bengali', 'Urdu', 'Persian', 'Hebrew', 'Swedish', 'Norwegian', 'Danish', 'Finnish', ...etc",
        })
        .option("openaiKey", {
          alias: "k",
          type: "string",
          default: undefined,
          description: "OpenAI API key",
        })
        .option("model", {
          alias: "m",
          type: "string",
          default: "gpt-4o-mini",
          description:
            "OpenAI model to use, e.g. 'gpt-3.5-turbo', 'gpt-4o-mini', ...etc",
        })
        .option("temperature", {
          alias: "t",
          type: "number",
          default: 0.3,
          description: "OpenAI temperature to use, e.g. 0.7, 0.8, ...etc",
        }),
    async (argv) => {
      const { input, language, outdir, openaiKey, model, temperature } = argv;
      return await subtitleTranslator({
        input: input!,
        outdir: outdir,
        model,
        apiKey: openaiKey,
        language,
        temperature,
      });
    }
  )
  .help()
  .alias("help", "h")
  .version(false)
  .strict()
  .parseAsync();
