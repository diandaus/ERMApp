package com.rsislamibnusinasigli.erm_tablet

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

// Channel "erm_tablet/update" — pembaruan aplikasi mandiri (tanpa Play Store):
// - updateDir: folder tujuan unduhan APK (cacheDir/update, terdaftar di
//   res/xml/file_paths.xml utk FileProvider)
// - canInstall: izin "Instal aplikasi tak dikenal" sudah diberikan?
// - openInstallSettings: buka layar izin tsb utk app ini
// - installApk(path): buka installer Android utk APK yg sudah diunduh
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "erm_tablet/update")
            .setMethodCallHandler { call, result ->
                try {
                    when (call.method) {
                        "updateDir" -> {
                            val dir = File(cacheDir, "update")
                            dir.mkdirs()
                            result.success(dir.absolutePath)
                        }
                        "canInstall" -> result.success(
                            Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                                packageManager.canRequestPackageInstalls()
                        )
                        "openInstallSettings" -> {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                startActivity(
                                    Intent(
                                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                        Uri.parse("package:$packageName")
                                    )
                                )
                            }
                            result.success(null)
                        }
                        "installApk" -> {
                            val file = File(call.argument<String>("path")!!)
                            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
                            val intent = Intent(Intent.ACTION_VIEW).apply {
                                setDataAndType(uri, "application/vnd.android.package-archive")
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            startActivity(intent)
                            result.success(null)
                        }
                        else -> result.notImplemented()
                    }
                } catch (e: Exception) {
                    result.error("UPDATE_ERROR", e.message, null)
                }
            }
    }
}
