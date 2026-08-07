import EvalParser from "@/core/catalog/utils/eval-parser";
import EvalExecutor from "@/core/catalog/utils/eval-executor";

const exprs = [
  '"VIS@HI.Q / CPI@US.Q".ts',
  '"VIS@HI.Q * 2".ts',
];

for (const e of exprs) {
  console.log("=== ", e);
  try {
    console.log(JSON.stringify(EvalParser.parse(e)));
  } catch (err) {
    console.log("PARSE ERR", (err as Error).message);
  }
  try {
    const r = await EvalExecutor.run(e);
    console.log("RESULT", [...r.data.entries()].slice(-2));
  } catch (err) {
    console.log("EXEC ERR", (err as Error).message);
  }
}
process.exit(0);
