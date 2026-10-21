package com.zamifu.analytics;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Locale;

@CapacitorPlugin(
    name = "NativePdfDownload",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class NativePdfDownloadPlugin extends Plugin {

    @PluginMethod
    public void requiresLegacyStoragePermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("required", Build.VERSION.SDK_INT < Build.VERSION_CODES.Q);
        call.resolve(result);
    }

    @PluginMethod
    public void savePdf(PluginCall call) {
        String encodedData = call.getString("base64");
        String requestedName = call.getString("fileName");
        if (encodedData == null || encodedData.isEmpty()) {
            call.reject("Missing PDF data.");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            && getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("Storage permission is required to save this PDF.");
            return;
        }

        String fileName = sanitizeFileName(requestedName);
        byte[] pdfBytes;
        try {
            pdfBytes = Base64.decode(encodedData, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("Invalid PDF data.");
            return;
        }
        if (pdfBytes.length == 0) {
            call.reject("The generated PDF is empty.");
            return;
        }

        Uri savedUri = null;
        try {
            savedUri = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? saveWithMediaStore(fileName, pdfBytes)
                : saveToLegacyDownloads(fileName, pdfBytes);

            showToast("PDF saved to Downloads/Zamifu");
            JSObject result = new JSObject();
            result.put("fileName", fileName);
            result.put("uri", savedUri.toString());
            call.resolve(result);
        } catch (Exception error) {
            if (savedUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                getContext().getContentResolver().delete(savedUri, null, null);
            }
            showToast("Could not save PDF to Downloads");
            call.reject("Unable to save PDF to Downloads/Zamifu.");
        }
    }

    private Uri saveWithMediaStore(String fileName, byte[] pdfBytes) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
        values.put(
            MediaStore.MediaColumns.RELATIVE_PATH,
            Environment.DIRECTORY_DOWNLOADS + File.separator + "Zamifu"
        );
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IOException("Could not create a Downloads entry.");
        }
        try {
            try (OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) {
                    throw new IOException("Could not open the Downloads entry.");
                }
                output.write(pdfBytes);
                output.flush();
            }
        } catch (IOException error) {
            resolver.delete(uri, null, null);
            throw error;
        }

        ContentValues ready = new ContentValues();
        ready.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(uri, ready, null, null);
        return uri;
    }

    @SuppressWarnings("deprecation")
    private Uri saveToLegacyDownloads(String fileName, byte[] pdfBytes) throws IOException {
        File folder = new File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "Zamifu"
        );
        if (!folder.exists() && !folder.mkdirs()) {
            throw new IOException("Could not create the Downloads folder.");
        }

        File destination = availableFile(folder, fileName);
        try {
            try (FileOutputStream output = new FileOutputStream(destination)) {
                output.write(pdfBytes);
                output.flush();
            }
        } catch (IOException error) {
            destination.delete();
            throw error;
        }
        return Uri.fromFile(destination);
    }

    private File availableFile(File folder, String fileName) {
        File candidate = new File(folder, fileName);
        if (!candidate.exists()) {
            return candidate;
        }
        String base = fileName.substring(0, fileName.length() - 4);
        int suffix = 1;
        do {
            candidate = new File(folder, base + "_" + suffix + ".pdf");
            suffix++;
        } while (candidate.exists());
        return candidate;
    }

    private String sanitizeFileName(String requestedName) {
        String name = requestedName == null ? "Zamifu_Analytics.pdf" : requestedName.trim();
        name = name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        if (name.isEmpty()) {
            name = "Zamifu_Analytics.pdf";
        }
        if (!name.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            name += ".pdf";
        }
        return name;
    }

    private void showToast(String message) {
        if (getActivity() != null) {
            getActivity().runOnUiThread(() ->
                Toast.makeText(getContext(), message, Toast.LENGTH_LONG).show()
            );
        }
    }
}
