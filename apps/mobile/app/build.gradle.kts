plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

val releaseStoreFile = providers.environmentVariable("DISPLAY_SIGNING_STORE_FILE").orNull
val releaseStorePassword = providers.environmentVariable("DISPLAY_SIGNING_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("DISPLAY_SIGNING_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("DISPLAY_SIGNING_KEY_PASSWORD").orNull
val hasReleaseSigning = listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword).all { !it.isNullOrBlank() }
val releasesApiUrl = providers.environmentVariable("DISPLAY_RELEASES_API_URL").orElse("https://example.invalid/releases/latest").get()
val productionApiUrl = providers.environmentVariable("DISPLAY_API_URL").orElse("https://studio.example.com").get()
fun quoted(value: String) = "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

android {
    namespace = "com.kmuc.display"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.kmuc.display"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.2.0"
        buildConfigField("String", "RELEASES_API_URL", quoted(releasesApiUrl))
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    signingConfigs {
        if (hasReleaseSigning) create("release") {
            storeFile = file(releaseStoreFile!!)
            storePassword = releaseStorePassword
            keyAlias = releaseKeyAlias
            keyPassword = releaseKeyPassword
        }
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_URL", "\"http://10.0.2.2:3000\"")
        }
        release {
            isMinifyEnabled = false
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
            buildConfigField("String", "API_URL", quoted(productionApiUrl))
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin {
        compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.03.01"))
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
    implementation("io.coil-kt.coil3:coil-compose:3.5.0")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.5.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
