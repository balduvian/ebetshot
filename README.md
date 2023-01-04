![ebetshot logo](extension/icon128.png)

# Ebetshot

A video screenshot extension for Chrome.

Bug me on discord if you encounter any issues @balduvian#2226.

## Get the Chrome Extension

You can easily download Ebetshot from the Chrome Web Store at this link: https://chrome.google.com/webstore/detail/ebetshot-%EC%97%90%EB%B2%B3%EC%85%A7/imhioeojmeppiofbppalcignahcckijc

## Manual Installation

Want to use a prerelease version of Ebetshot before it's available on the Chrome Web Store?

Click on Releases tab on the right or just follow the link https://github.com/balduvian/ebetshot/releases.

Download the zip file from the latest available release.

Extract the contents of the downloaded zip file into a folder. Place that folder somewhere where you can remember.

Open up Chrome and go to `chrome://extensions/`.

In the top right hand corner, enable the toggle for "Developer mode." Now 3 more buttons become available to the left.

Click on "Load unpacked" and navigate the the extracted folder. Then click "Select Folder."

Ebetshot should now appear in your extensions list!

## Firefox Compatibility

Ebetshot now has tenuous Firefox compatibility. Not all features are guaranteed to work, and this is definitely a work in progress. Note that the extension in Firefox is still manifest v3, therefore it can only be used with Firefox Developer Edition.

## Building from source

Use the `webpack` command in the project directory.

If you want to build for Firefox, instead use `webpack --env=firefox`.
