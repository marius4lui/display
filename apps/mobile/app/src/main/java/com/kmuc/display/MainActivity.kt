package com.kmuc.display

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.kmuc.display.ui.theme.DisplayTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DisplayTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    DisplayScreen()
                }
            }
        }
    }
}

@Composable
private fun DisplayScreen() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = "display", style = MaterialTheme.typography.displayLarge)
        Text(text = "Dashboard-System")
    }
}

@Preview(showBackground = true)
@Composable
private fun DisplayPreview() {
    DisplayTheme { DisplayScreen() }
}

