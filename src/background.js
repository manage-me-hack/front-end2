let imageCapture,
  photoWidth,
  apiUrl = "http://127.0.0.1:8000";

let executeScript = async (fun) => {
  chrome.runtime.sendMessage({ popup_open: true });
  chrome.storage.local.get(["tabIdGlobal"], async ({ tabIdGlobal }) => {
    if (!tabIdGlobal) {
      const tab = await chrome.tabs.create({
        active: false,
        url: "https://www.google.com",
        pinned: true,
      });
      chrome.storage.local.set({ tabIdGlobal: tab.id });
      chrome.tabs.onUpdated.addListener(async function (
        tabId,
        changeInfo,
        tab
      ) {
        if (tabId === tabIdGlobal && changeInfo.status == "complete") {
          tabIdGlobal = tabId;
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: fun,
          });
        }
      });
    } else {
      await chrome.scripting.executeScript(
        {
          target: { tabId: tabIdGlobal },
          function: fun,
        },
        async () => {
          const tabOpen = await checkTabStillOpen(tabIdGlobal);
          if (!tabOpen) {
            chrome.storage.local.remove(["tabIdGlobal"]);
            executeScript(getAccess);
          }
        }
      );
    }
  });
};

async function checkTabStillOpen(pinnedTabId) {
  return new Promise(function (resolve, reject) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id === pinnedTabId) {
          resolve(true);
        }
      });
      resolve(false);
    });
  });
}

let getAccess = async () => {
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(async (stream) => {
      const track = stream.getVideoTracks()[0];
      imageCapture = new ImageCapture(track);
      var reader = new FileReader();
      const blob = await imageCapture.takePhoto();
      reader.readAsDataURL(blob);
      reader.onloadend = function () {
        const post = async (url, data) => {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-type": "application/json",
            },
            body: JSON.stringify(data),
          });

          const resData = await response.json();
          return resData;
        };

        var base64data = reader.result;
        console.log(base64data);
        post(`http://127.0.0.1:8000/utils/face-detect/`, {
          path: base64data,
          choice: 1,
        })
          .then((res) => {
            if (res?.emotion?.sadness) {
              chrome.runtime.sendMessage({ state: "tired" });
              chrome.runtime.sendMessage({ popup_open_new_tab: true });
              // chrome.window.create({
              //   height: "600px",
              //   width: "400px",
              //   url: "popup.html",
              // });
            }
            console.log(res);
          })
          .catch((err) => console.log(err.message));
      };
      return true;
    })
    .catch((error) => console.log(error));
};

chrome.alarms.create({ periodInMinutes: 0.1 });
chrome.alarms.onAlarm.addListener(() => {
  executeScript(getAccess);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(["tabIdGlobal"], ({ tabIdGlobal }) => {
    if (tabId === tabIdGlobal) {
      chrome.storage.local.remove(["tabIdGlobal"]);
    }
  });
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // chrome.windows.getAll((windows) => windows[0]).width
  if (request.popup_open_new_tab) {
    chrome.windows.create({
      height: 600,
      width: 400,
      // top: ,
      type: "popup",
      url: "popup.html",
    });
  }
});
