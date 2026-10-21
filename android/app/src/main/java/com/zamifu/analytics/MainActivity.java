package com.zamifu.analytics;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePdfDownloadPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
