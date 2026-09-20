import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val signingPropertiesFile = rootProject.file("keystore.properties")
val signingProperties = Properties().apply {
    if (signingPropertiesFile.exists()) signingPropertiesFile.inputStream().use { load(it) }
}
val localSigningPath = providers.environmentVariable("DISPLAY_KEYSTORE_PATH").orNull
val localSigningPassword = providers.environmentVariable("DISPLAY_SIGNING_PASSWORD").orNull
val hasSigning = signingPropertiesFile.exists() || (localSigningPath != null && localSigningPassword != null)

android {
    namespace = "com.marius4lui.display"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.marius4lui.display"
        minSdk = 30
        targetSdk = 36
        versionCode = 103
        versionName = "0.1.3"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (hasSigning) {
            create("release") {
                storeFile = file(localSigningPath ?: signingProperties.getProperty("storeFile"))
                storePassword = localSigningPassword ?: signingProperties.getProperty("storePassword")
                keyAlias = signingProperties.getProperty("keyAlias", "display")
                keyPassword = localSigningPassword ?: signingProperties.getProperty("keyPassword")
            }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (hasSigning) signingConfig = signingConfigs.getByName("release")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions.jvmTarget = "17"

    testOptions.unitTests.isIncludeAndroidResources = true
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.squareup.okhttp3:okhttp:5.5.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
}
