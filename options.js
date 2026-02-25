let api = null;

const STORAGE_KEYS = {
    CLICKNLOAD_ACTIVE: 'settings_clicknload_active',
    CONTEXT_MENU_SIMPLE: 'settings_context_menu_simple',
    DEFAULT_PREFERRED_JD: 'settings_default_preferred_jd'
};

function showMessage(msg, isError = false) {
    const el = document.getElementById('login-message');
    el.textContent = msg;
    el.style.color = isError ? 'red' : 'green';
    setTimeout(() => el.textContent = '', 3000);
}

function initApi() {
    if (typeof API === 'undefined') {
        setTimeout(initApi, 500);
        return;
    }
    
    api = new API({
        API_ROOT: "https://api.jdownloader.org",
        APP_KEY: "myjd_webextension_mv3"
    });
    
    const savedSession = localStorage.getItem('jdapi_session');
    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            if (session && session.sessiontoken) {
                api.jdAPICore.options = session;
            }
        } catch(e) {}
    }
    
    chrome.storage.local.get([
        'myjd_creds',
        STORAGE_KEYS.CLICKNLOAD_ACTIVE,
        STORAGE_KEYS.CONTEXT_MENU_SIMPLE,
        STORAGE_KEYS.DEFAULT_PREFERRED_JD
    ], function(result) {
        if (result.myjd_creds) {
            try {
                const creds = JSON.parse(result.myjd_creds);
                if (creds.email) document.getElementById('email').value = creds.email;
            } catch(e) {}
        }
        
        if (result[STORAGE_KEYS.CLICKNLOAD_ACTIVE] !== undefined) {
            document.getElementById('clicknload_active').checked = result[STORAGE_KEYS.CLICKNLOAD_ACTIVE];
        }
        
        if (result[STORAGE_KEYS.CONTEXT_MENU_SIMPLE] !== undefined) {
            document.getElementById('context_menu_simple').checked = result[STORAGE_KEYS.CONTEXT_MENU_SIMPLE];
        } else {
            document.getElementById('context_menu_simple').checked = true;
        }
        
        if (result[STORAGE_KEYS.DEFAULT_PREFERRED_JD]) {
            document.getElementById('preferred_device').value = result[STORAGE_KEYS.DEFAULT_PREFERRED_JD].id || 'AskEveryTimeDevice';
        }
    });
}

setTimeout(initApi, 1000);

document.getElementById('login-btn').addEventListener('click', function() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showMessage('Please enter email and password', true);
        return;
    }
    
    if (!api) {
        showMessage('API not loaded', true);
        return;
    }
    
    showMessage('Logging in...');
    
    api.connect({ email: email, pass: password }).done(function() {
        // Only store email for convenience, never store password in plaintext
        chrome.storage.local.set({ myjd_creds: JSON.stringify({ email: email }) });
        localStorage.setItem('jdapi_session', JSON.stringify(api.jdAPICore.options));
        showMessage('Logged in!');
        refreshDevices();
    }).fail(function(err) {
        showMessage('Login failed: ' + (err.message || err), true);
    });
});

document.getElementById('logout-btn').addEventListener('click', function() {
    if (api) {
        api.disconnect().always(function() {
            localStorage.removeItem('jdapi_session');
            chrome.storage.local.remove(['myjd_creds']);
            showMessage('Logged out');
        });
    }
});

function refreshDevices() {
    if (!api || !api.jdAPICore.options.sessiontoken) {
        showMessage('Not logged in', true);
        return;
    }
    
    api.listDevices().done(function(devices) {
        const select = document.getElementById('preferred_device');
        select.innerHTML = '<option value="AskEveryTimeDevice">Ask every time</option>';
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = device.name;
            select.appendChild(option);
        });
        showMessage('Devices refreshed');
    }).fail(function(err) {
        showMessage('Failed to get devices', true);
    });
}

document.getElementById('refresh-devices-btn').addEventListener('click', refreshDevices);

function saveSetting(key, value) {
    chrome.storage.local.set({ [key]: value });
}

document.getElementById('clicknload_active').addEventListener('change', function() {
    saveSetting(STORAGE_KEYS.CLICKNLOAD_ACTIVE, this.checked);
});

document.getElementById('context_menu_simple').addEventListener('change', function() {
    saveSetting(STORAGE_KEYS.CONTEXT_MENU_SIMPLE, this.checked);
});

document.getElementById('preferred_device').addEventListener('change', function() {
    const deviceId = this.value;
    const deviceName = this.options[this.selectedIndex].text;
    saveSetting(STORAGE_KEYS.DEFAULT_PREFERRED_JD, { id: deviceId, name: deviceName });
});
