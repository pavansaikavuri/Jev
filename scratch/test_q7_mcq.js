const fs = require("fs");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

// Load extractor
const extractorCode = fs.readFileSync("extension/extractor.js", "utf8");

// Mock HTML matching Question 7/15 from the user's screenshot
const html = `
<!DOCTYPE html>
<html>
<head><title>MCQ PRACTICE | LARGEST SUBARRAY SUM</title></head>
<body>
  <div>
    <button>PRACTICE INSTRUCTIONS</button>
    <div>SCORE: 6</div>
    <div>QUESTIONS ATTEMPTED: 7/15</div>
    <button>END PRACTICE</button>
  </div>
  <div class="question-container">
    <div>
      Given an array <span class="code-pill">arr</span> = <span class="code-pill">[2, -1, 2, 3, -9]</span> , what is the largest sum of a subarray?
    </div>
    <div class="options-container">
      <div class="sc-option"><input type="radio" name="opt" value="0"> 5</div>
      <div class="sc-option"><input type="radio" name="opt" value="1"> 6</div>
      <div class="sc-option"><input type="radio" name="opt" value="2"> 4</div>
      <div class="sc-option"><input type="radio" name="opt" value="3"> 3</div>
    </div>
    <div class="error-msg">Please select an option</div>
    <div>
      <button>SHOW ANSWER</button>
      <button type="submit">SUBMIT</button>
    </div>
    <div>
      <button class="skip-btn">SKIP</button>
      <div>If you skip, you can attempt this question again after finishing all questions</div>
    </div>
  </div>
</body>
</html>
`;

const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;
const document = window.document;

// Execute extractor in window context
const evalFn = new Function("window", "document", extractorCode + "; return QuizZyExtractor;");
const QuizZyExtractor = evalFn(window, document);

const result = QuizZyExtractor.extractQuizFromDom(document);
console.log("Extraction Result:", JSON.stringify({
  success: result.success,
  error: result.error,
  q_type: result.q_type,
  question: result.question,
  options: result.options
}, null, 2));
