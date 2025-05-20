function getInfoFiles(dir) {
    // if the directory is in the excludedDirectories array, skip it
    if (excludedDirectories.includes(dir)) {
        return;
    }

    // read the contents of the directory
    const files = fs.readdirSync(dir);

    // if a info.json file is nested in a directory that contains a prarent info.json file
    // the child info.json contents should be added to the parent info.json tabs array

    // loop through the files
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // if the file is a directory, recursively call this function
        if (stat.isDirectory()) {
            getInfoFiles(filePath);
        } else if (file === 'info.json') {
            // if the file is info.json, read its contents and add it to the tabs array
            const info = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            // get the component info from the root/component-properties folder using the componentPath property
            if (info.componentPath) {
                const componentPath = path.join(rootDir, "component-properties/" + info.componentPath + ".json");
                // console.log('Component Path:', componentPath);

                // if the component info file exists, read its contents and add it to the info object as componentData
                if (fs.existsSync(componentPath)) {
                    const componentData = JSON.parse(fs.readFileSync(componentPath, 'utf-8'));
                    // console.log('Component Info: ', componentData);
                    info.componentData = componentData;
                }
            }

            // check if the parent directory has an info.json file
            const parentDir = path.dirname(dir);
            const parentInfoPath = path.join(parentDir, 'info.json');
            if (fs.existsSync(parentInfoPath)) {
                // if the parent directory has an info.json file, add the child info to the parent info tabs array
                const parentInfo = JSON.parse(fs.readFileSync(parentInfoPath, 'utf-8'));

                if (!parentInfo.tabs) {
                    parentInfo.tabs = [];
                }

                // console.log('Info Name:', info.name);
                // console.log('parentInfoPath:', parentInfoPath);

                // find tab in the tabs array that has the same tabId as the parentInfo tabId
                const tabIndex = parentInfo.tabs.findIndex(tab => tab.tabId === info.tabId);
                if (tabIndex === -1) {
                    // if the tab does not exist, add it to the tabs array
                    parentInfo.tabs.push(info);
                } else {
                    // if the tab exists, update it with the new info
                    parentInfo.tabs[tabIndex] = info;
                }
            } else {
                // if the parent directory does not have an info.json file, add the info to the tabs array
                tabs.push(info);
            }
        }
    }
}