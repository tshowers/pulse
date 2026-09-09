import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component( {
  selector: 'app-pulse-app-showcase',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-showcase.component.html',
  styleUrl: './app-showcase.component.css'
} )
export class AppShowcaseComponent {
  readonly highlights = [
    { heading: 'Build the question wherever the idea starts', copy: 'Create a pulse from your phone while the conversation is still fresh, then publish it when the question is ready.' },
    { heading: 'Collect responses without carrying a laptop', copy: 'Share one link and let people respond from any device. Every answer lands in the same Pulse workspace.' },
    { heading: 'Read the signal before the moment passes', copy: 'See response counts, option tallies, and open-text feedback as they arrive so the next move is easier to make.' }
  ];
}
