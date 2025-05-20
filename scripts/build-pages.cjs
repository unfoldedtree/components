const fs = require('fs');
const path = require('path');
const parser = require('showdown');
const hljs = require('highlight.js');
const HTMLParser = require('node-html-parser');

// grab the index.json file from showcase dir and parse it as JSON
const showcaseDir = path.join(__dirname, '../showcase');
const rootDir = path.join(__dirname, '../');
const indexPath = path.join(showcaseDir, 'index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

// log the initial index object
// console.log('Initial Index:', index);

// get excludedDirectories array property on the index object
const excludedDirectories = index.excludedDirectories || [];

// get the info.json files from the showcase dir
// store then in the tabs array under the name of the directory
function getNestedStructure(dir, fileName, excludedDirs = []) {
    const tabs = [];

    function traverse(currentDir) {
        // Get all items in the current directory
        const items = fs.readdirSync(currentDir);

        // Filter directories and exclude specified ones
        const directories = items.filter((item) => {
            const itemPath = path.join(currentDir, item);
            return fs.statSync(itemPath).isDirectory() && !excludedDirs.includes(item);
        });

        // Check for the target file in the current directory
        const targetFilePath = path.join(currentDir, fileName);
        const currentTab = {
            name: path.basename(currentDir),
        };

        if (fs.existsSync(targetFilePath)) {
            // Read and parse the target file if it exists
            const fileContent = JSON.parse(fs.readFileSync(targetFilePath, 'utf-8'));
            Object.assign(currentTab, fileContent);

            if (currentTab.componentPath) {
                const componentPath = path.join(rootDir, "component-properties/" + currentTab.componentPath + ".json");

                // if the component info file exists, read its contents and add it to the info object as componentData
                if (fs.existsSync(componentPath)) {
                    const componentData = JSON.parse(fs.readFileSync(componentPath, 'utf-8'));
                    currentTab.componentData = componentData;
                }
            }
        }

        // Recursively traverse subdirectories
        directories.forEach((subDir) => {
            const subDirPath = path.join(currentDir, subDir);

            // Only traverse if the directory contains the target file
            const subDirFilePath = path.join(subDirPath, fileName);
            if (!fs.existsSync(subDirFilePath)) {
                return;
            }

            const childTab = traverse(subDirPath);
            if (childTab) {
                if (!currentTab.children) {
                    currentTab.children = [];
                }

                currentTab.children.push(childTab);
            }
        });

        return currentTab;
    }

    // Start traversal from the root directory
    tabs.push(traverse(dir));

    return tabs[0].children || [];
}

const tabs = getNestedStructure(showcaseDir, 'info.json', excludedDirectories).sort((a, b) => {
    const orderA = a.order || 0;
    const orderB = b.order || 0;
    return orderA - orderB;
});

index.page.tabs = tabs;

// get directory name of current file
const currentFilePath = path.resolve(__filename);
const currentDir = path.dirname(currentFilePath);
const outputDir = path.join(currentDir, '/output');
const jsonOutputPath = path.join(outputDir, '/output.json');

fs.writeFileSync(jsonOutputPath, JSON.stringify(index, null, 2), 'utf-8');

// add the tabs array to the index object
// log the index object
// console.log('Index:', index);

// Function to convert README.md to HTML
async function convertReadmeToHtml(readmePath) {
    try {
        // const converter = new parser.Converter({
        //     moreStyling: true,
        //     ghCodeBlocks: true,
        // });

        const converter = new parser.Converter({
            tables: true
        });

        const readmeContent = fs.readFileSync(readmePath, 'utf-8');
        let htmlContent = converter.makeHtml(readmeContent);
        const htmlObject = HTMLParser.parse(htmlContent);

        // add tailwind classes to the html content
        htmlObject.querySelectorAll('h1').forEach((h1) => {
            h1.setAttribute('class', 'text-3xl font-bold mb-4');
        });

        htmlObject.querySelectorAll('h2').forEach((h2) => {
            h2.setAttribute('class', 'text-2xl font-bold mb-4');
        });

        htmlObject.querySelectorAll('h3').forEach((h3) => {
            h3.setAttribute('class', 'text-xl font-bold mb-4');
        });

        htmlObject.querySelectorAll('h4').forEach((h4) => {
            h4.setAttribute('class', 'text-lg font-bold mb-4');
        });

        htmlObject.querySelectorAll('h5').forEach((h5) => {
            h5.setAttribute('class', 'text-base font-bold mb-4');
        });

        htmlObject.querySelectorAll('h6').forEach((h6) => {
            h6.setAttribute('class', 'text-sm font-bold mb-4');
        });

        htmlObject.querySelectorAll('p').forEach((p) => {
            p.setAttribute('class', 'text-base mb-4');
        });

        htmlObject.querySelectorAll('ul').forEach((ul) => {
            ul.setAttribute('class', 'list-disc list-inside mb-4');
        });

        htmlObject.querySelectorAll('ol').forEach((ol) => {
            ol.setAttribute('class', 'list-decimal list-inside mb-4');
        });

        htmlObject.querySelectorAll('li').forEach((li) => {
            li.setAttribute('class', 'mb-2');
        });

        htmlObject.querySelectorAll('blockquote').forEach((blockquote) => {
            blockquote.setAttribute('class', 'border-l-4 border-gray-500 pl-4 italic mb-4');
        });

        htmlObject.querySelectorAll('table').forEach((table) => {
            table.setAttribute('class', 'table-auto w-full mb-4');
        });

        htmlObject.querySelectorAll('th').forEach((th) => {
            th.setAttribute('class', 'px-4 py-2 border-b border-gray-500 bg-gray-200');
        });

        htmlObject.querySelectorAll('td').forEach((td) => {
            td.setAttribute('class', 'px-4 py-2 border-b border-gray-500');
        });

        // style the "code" blocks
        htmlObject.querySelectorAll('code').forEach((code) => {
            // if parent is "pre" tag, skip it
            if (code.parentNode.tagName === 'PRE') {
                return;
            }

            const codeContent = code.textContent;
        
            // remove double quotes from the beginning and end of the code content
            const cleanedCodeContent = codeContent.replace(/^"/, '').replace(/"$/, '');

            // highlight the code block
            const highlightedCode = hljs.highlightAuto(cleanedCodeContent).value;

            code.innerHTML = highlightedCode;
        
            // highlight the code block
            code.setAttribute('class', 'hljs !px-2 !py-1 rounded');
        });

        // stlye the "pre code" blocks
        htmlObject.querySelectorAll('pre').forEach((codeBlock) => {
            const codeHtml = HTMLParser.parse(codeBlock.innerHTML);

            codeHtml.querySelectorAll('code').forEach((code) => {

                // console.log('Code Block:', codeBlock.textContent);

                const codeContent = code.textContent;

                // add hljs class to the code block
                code.setAttribute('class', 'text-sm font-mono hljs !p-2 rounded my-2');

                // remove double quotes from the beginning and end of the code content
                // const cleanedCodeContent = codeContent.replace(/^"/, '').replace(/"$/, '');
                const cleanedCodeContent = codeContent;

                // highlight the code block
                const highlightedCode = hljs.highlightAuto(cleanedCodeContent).value;

                // replace the code block with the highlighted code
                code.innerHTML = highlightedCode;
            });

            codeBlock.innerHTML = codeHtml.toString();
        });

        // put in the "/showcase/getting-started`" directory
        const outputDir = path.join(__dirname, '../showcase/getting-started');
        const outputHtmlPath = path.join(outputDir, 'getting-started.html');
        fs.writeFileSync(outputHtmlPath, htmlObject.toString(), 'utf-8');

        return htmlContent;
    } catch (error) {
        console.error(`Error converting ${readmePath} to HTML:`, error);
        return null;
    }
}

convertReadmeToHtml(path.join('README.md'));

