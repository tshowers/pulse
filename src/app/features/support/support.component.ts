import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component( {
  selector: 'app-pulse-support',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './support.component.html',
  styleUrl: './support.component.css'
} )
export class SupportComponent {
  readonly faqs = [
    { question: 'How do I create a Pulse?', answer: 'Sign in, then choose "Create a Pulse" from the menu. Build your question, publish it, and share the link.' },
    { question: 'How do I sign in or recover access?', answer: 'Use the Sign In link from the menu. If you’re having trouble getting in, email support and we’ll help you regain access.' },
    { question: 'How do I delete my account or data?', answer: 'Email support@taliferro.tech from the address on your account and we’ll delete your account and associated data.' }
  ];
}
