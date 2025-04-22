import "colors";
import { mkdir, readFile, writeFile } from "fs/promises";
import { glob } from "glob";
import OpenAI from "openai";
import pMap from "p-map";
import path from "path";
import DIE from "phpdie";
import { parseSync, stringifySync } from "subtitle";

if (import.meta.main) {
  await pMap(
    [
      "Chinese Simplified",
      "English",
      "Japanese",
      "Korean",
      "Chinese Traditional",
      "French",
      "Spanish",
      "German",
      "Russian",
      "Italian",
      "Portuguese",
      "Arabic",
      "Turkish",
      "Thai",
      "Vietnamese",
      "Indonesian",
      "Malay",
      "Filipino",
      "Hindi",
      "Bengali",
      "Urdu",
      "Persian",
      "Hebrew",
      "Swedish",
      "Norwegian",
      "Danish",
      "Finnish",
    ],
    (lang) =>
      subtitleTranslator({
        language: lang,
        input: "./src/*.{srt,vtt}",
        outdir: `./res-${lang}`,
      }),
    { concurrency: 1 }
  );
}

/**
 *
 * @author: modifyied by snomiao <snomiao@gmail.com>, forked from https://github.com/gnehs/subtitle-translator
 */
export default async function subtitleTranslator({
  input = "./*.{vtt,srt}",
  language = "English",
  model = "gpt-4o-mini",
  outdir,
  reference = "./reference.txt",
  apiKey = process.env.OPENAI_API_KEY,
  temperature = 0.0,
}: {
  language?: string;
  model?: string;
  input?: string | string[];
  outdir?: string;
  apiKey?: string;
  reference?: string;
  temperature?: number;
} = {}) {
  outdir ||= `./translated-${language}`;
  const subtitles = (await glob(input)).sort();

  if (subtitles.length === 0) {
    console.log(`No subtitles found for ${input}`.red);
    return;
  }
  const supportExtensions = [".srt", ".vtt"];
  const subtitleFiles = subtitles.filter((file) =>
    supportExtensions.some((ext) => file.endsWith(ext))
  );
  await pMap(
    subtitleFiles,
    async (subtitleFile, subtitleFileIndex) => {
      const name = path.parse(subtitleFile).name;
      const outSrtFile = `${outdir}/${name}.srt`;

      await mkdir(outdir, { recursive: true });
      if (await readFile(outSrtFile, "utf8").catch((e) => false)) {
        console.log(`${outSrtFile} already exists, skipping...`.yellow);
        return;
      }

      const task = { from: subtitleFile, to__: outSrtFile, language };
      console.log(
        `Translating ${subtitleFileIndex + 1} / ${
          subtitleFiles.length
        } ${JSON.stringify(task, null, 2)}...`.blue
      );

      let subtitle = parseSync(
        await readFile(`./${subtitleFile}`, "utf8")
      ).filter((line) => line.type === "cue");

      let previousSubtitles: any[] = [];

      for (let i = 0; i < subtitle.length; i++) {
        const text = subtitle[i].data.text;
        const _nextInputForReference = subtitle[i + 1]?.data?.text;
        const input = {
          input: text,
          ...(_nextInputForReference && { _nextInputForReference }),
        };

        const completion = await (async function () {
          for (;;) {
            try {
              const openai = new OpenAI({ apiKey });
              return await openai.chat.completions.create(
                {
                  model,
                  temperature,
                  messages: [
                    ...(!reference
                      ? []
                      : [
                          {
                            role: "system",
                            content: `${await readFile(reference, "utf8")}`,
                          },
                        ]),
                    {
                      role: "system",
                      content: `You are a program responsible for translating subtitles. Your task is to output the specified target language based on the input text. Please do not create the following subtitles on your own. Please do not output any text other than the translation. You will receive the subtitles as array that needs to be translated, as well as the previous translation results and next subtitle. If you need to merge the subtitles with the following line, simply repeat the translation. Please transliterate the person's name into the local language. Target language: ${language}. output in JSON format, {"output": "translated only from input, ignore _nextInput"}, no explains.`,
                    },
                    ...previousSubtitles.slice(-4),
                    {
                      role: "user",
                      content: JSON.stringify(input),
                    },
                  ],
                },
                { timeout: 60 * 1000 }
              );
              break;
            } catch (e) {
              console.error(`Error:    ${e}`);
              console.log("retrying...".red);
            }
          }
        })();
        let result = completion.choices[0].message.content;
        try {
          result =
            JSON.parse(result!).output ?? DIE("parsed but missing output");
        } catch (e) {
          try {
            result = result!.match(/"output":"(.*?)"/)![1];
          } catch (e) {
            console.log("###".red);
            console.log(e.toString().red);
            console.log(result!.red);
            console.log("###".red);
          }
        }
        previousSubtitles.push({
          role: "user",
          content: JSON.stringify(input),
        });
        previousSubtitles.push({
          role: "assistant",
          content: JSON.stringify({ output: result }),
        });
        // console.log(`${subtitle[i].data.text}`.blue)
        if (result !== text) {
          subtitle[i].data.text = `${result}\n${text}`;
        }
        console.log(
          `-----------------`.gray,
          `${i + 1} / ${subtitle.length}`.gray
        );
        console.log(`${previousSubtitles.at(-2).content}`.green);
        console.log(`${previousSubtitles.at(-1).content}`.white);
        // console.log(`${result}`.green);
        // console.log(`${text}`.white);
      }
      await writeFile(outSrtFile, stringifySync(subtitle, { format: "SRT" }));
    },
    { concurrency: 1 }
  );
}
