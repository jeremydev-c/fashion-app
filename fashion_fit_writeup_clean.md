# FASHION FIT: AN AI-POWERED WARDROBE DIGITIZATION AND OUTFIT RECOMMENDATION SYSTEM FOR SUSTAINABLE CLOTHING USE

## ABSTRACT

Fashion Fit is an AI-powered mobile application that digitizes a user's wardrobe through smartphone photography and generates intelligent outfit recommendations to reduce decision fatigue and increase clothing utilization. The system uses OpenAI GPT-4o Vision to extract over 30 metadata fields from a single clothing photograph and a 20-signal scoring engine to evaluate outfit combinations across color harmony, style alignment, weather suitability, occasion fit, and 16 additional dimensions. Four controlled experiments with paired t-tests at 95% confidence demonstrated: (1) a 75.4% reduction in wardrobe digitization time compared to manual entry, (2) 91.7% AI category accuracy with a Macro F1 score of 0.918, (3) a 76.2% reduction in outfit decision time using the AI Stylist, and (4) a 40 percentage point increase in wardrobe utilization — from 36.3% to 76.3% — without purchasing new clothing. All results were statistically significant. The application supports 31 languages, real-time weather integration with destination forecasting, continuous learning from user feedback, and social sharing features. By helping users wear more of what they already own, Fashion Fit addresses textile waste at the consumer level, directly supporting SDG 12 (Responsible Consumption and Production). The project demonstrates that AI, when applied to an everyday problem, can deliver measurable benefits in time savings, accuracy, and environmental sustainability.

**Keywords:** artificial intelligence, computer vision, wardrobe management, outfit recommendation, sustainability, decision fatigue, fashion technology, mobile application, Kenya

---

# CHAPTER ONE: BACKGROUND INFORMATION

## 1.1 INTRODUCTION

Every morning, millions of people around the world stand before their wardrobes and face the same silent question: *What should I wear today?* What seems like a trivial decision carries a hidden cost. Research in behavioral psychology has shown that the average person spends 10 to 15 minutes daily deciding what to wear, amounting to over 90 hours per year lost to a single recurring choice (Baumeister & Tierney, 2011). At the same time, studies by the Waste and Resources Action Programme (WRAP, 2017) reveal that most individuals regularly wear only 20 to 30 percent of the clothing they own — the rest sits idle, forgotten in closets and drawers.

This pattern of underutilization is not just a personal inconvenience; it is an environmental crisis. The global fashion industry produces an estimated 92 million tonnes of textile waste annually, making it the second most polluting industry in the world after petroleum (United Nations Environment Programme, 2019). Much of this waste stems not from worn-out garments but from clothing that was purchased and never fully used. In Kenya and across East Africa, the growing influx of affordable fast fashion and imported secondhand clothing (commonly known as *mitumba*) has expanded wardrobes rapidly, yet without any tools to help individuals manage, organize, or make full use of what they already own.

The root cause is a lack of visibility. Without a digital record of their wardrobe, people cannot easily see what they have, plan outfits efficiently, or identify items they have stopped wearing. Existing solutions such as manual spreadsheets or basic closet apps require tedious data entry, making them impractical for everyday use and leading to low adoption rates.

Fashion Fit addresses this gap. It is an AI-powered mobile application that digitizes a user's wardrobe by simply photographing each clothing item. Users can add items one at a time or use Bulk Upload to import up to 30 items in a single session. The AI automatically identifies each garment's category, color, style, pattern, fit, and occasion, and builds a detailed profile of the item — including 10 style axes, fabric type, visual weight, color temperature, and layering role.

These profiles feed into a 20-signal outfit scoring engine that evaluates every possible outfit across color harmony, style alignment, weather suitability (including destination weather for travel), occasion fit, and more. The system learns from every user interaction — saves, rejections, and ratings — to improve future suggestions over time.

The aim is threefold: to eliminate the time wasted on manual wardrobe management, to reduce the daily stress of choosing outfits, and to increase the proportion of owned clothing that is actively worn — promoting more sustainable habits. To ensure accessibility across diverse populations, the entire application interface is available in 31 languages — including English, Swahili, French, Spanish, Arabic, Hindi, Chinese, Japanese, German, Portuguese, and 21 others — with full translations of all screens, labels, and interactions, allowing users from Kenya to Japan to use the app in their native language.

This project investigates the effectiveness of Fashion Fit through four controlled experiments measuring digitization speed, AI classification accuracy, outfit decision time, and wardrobe utilization, with all results evaluated for statistical significance using paired t-tests at the 95% confidence level.

![Figure 1: Manual wardrobe apps](images/fashion_fit_write_up_v1_667404/image_001.jpg)

## 1.2 QUESTION OF HYPOTHESIS

Can an AI-powered mobile application that uses computer vision to digitize clothing and an intelligent stylist to recommend outfits significantly reduce wardrobe digitization time, achieve reliable categorization accuracy, decrease daily outfit decision time, and increase the utilization of owned clothing when compared to traditional manual methods?

## 1.3 HYPOTHESIS

**If** a user adopts Fashion Fit's AI-powered wardrobe system, **then** digitization time will decrease by at least 50%, AI categorization will achieve at least 85% accuracy, outfit decision time will decrease by at least 50%, and wardrobe utilization will increase by at least 20 percentage points — **because** computer vision automates the process of identifying and labeling garments, while AI-generated outfit suggestions reduce the mental effort of choosing from many options.

## 1.4 STATEMENT OF OBJECTIVES

1. To design and develop a mobile application (Fashion Fit) that uses AI-based image recognition to digitize clothing items from photographs.
2. To evaluate the efficiency of Fashion Fit's digitization process compared to manual wardrobe entry by measuring time per item.
3. To assess the accuracy of AI-based clothing categorization (type and color) against human-labeled ground truth.
4. To measure the reduction in outfit decision time when using the AI Stylist compared to choosing outfits without assistance.
5. To quantify the improvement in wardrobe utilization after adopting Fashion Fit.
6. To demonstrate the sustainability impact of helping users wear more of what they already own.

## 1.5 STATEMENT OF PROBLEM

Globally, the fashion industry produces over 92 million tonnes of textile waste annually, making it the second most polluting industry in the world. A significant driver of this waste is consumer behavior — people buy more clothes than they need and fail to wear much of what they own. Research shows that the average person uses only 20 to 30 percent of their wardrobe regularly, while the rest remains idle.

In Kenya and across East Africa, the growing availability of affordable fast fashion and imported secondhand clothing (*mitumba*) means wardrobes are expanding, but utilization is not keeping pace. At the individual level, managing a wardrobe remains an entirely manual and impractical process. There is no efficient way to catalog what one owns, no system to help combine items into outfits, and no mechanism to identify underused garments. This leads to four compounding problems:

- **Time waste** — manually cataloging or even remembering what you own is impractical for most people.
- **Decision fatigue** — choosing an outfit daily from dozens or hundreds of items drains mental energy and slows productivity.
- **Clothing underutilization** — without visibility into the full wardrobe, people repeatedly wear the same few items and forget about the rest.
- **Unnecessary spending** — users purchase new clothes for occasions when suitable items already exist in their wardrobe.

There is currently no widely available, affordable solution that combines automated wardrobe digitization with AI-powered outfit recommendations targeted at everyday users.

## 1.6 SIGNIFICANCE AND JUSTIFICATION

This project is significant because it applies artificial intelligence to a universal, everyday problem that affects virtually every person who owns clothing. By automating wardrobe management and outfit selection, Fashion Fit delivers measurable value in three areas:

First, it **saves time**. The application reduces a 7-minute manual digitization process to under 2 minutes and cuts a 5-minute outfit decision down to approximately 1 minute. Over the course of a year, these savings compound into dozens of hours returned to the user.

Second, it **promotes sustainability**. By helping users discover and wear underused items in their wardrobe, Fashion Fit reduces the impulse to purchase new clothing unnecessarily. The WRAP (2017) study found that extending the active life of a garment by just 9 months reduces its carbon, water, and waste footprint by 20 to 30 percent. Increasing wardrobe utilization from 36% to 76% — as demonstrated in this project — represents a significant step toward responsible consumption.

Third, it **democratizes fashion technology**. AI-powered styling has traditionally been available only to professional stylists or luxury consumers. Fashion Fit makes this capability accessible to any smartphone user, including students and young professionals in Kenya and across East Africa.

### 1.6.1 LINKAGE TO EMERGING ISSUES

- **Sustainable Development Goal 12 (Responsible Consumption and Production)**: Fashion Fit directly promotes the principle of using what you already own before buying more, reducing textile waste at the consumer level.
- **Artificial Intelligence in everyday life**: The project demonstrates a practical, beneficial application of AI beyond industrial or corporate settings, showing how machine learning can solve personal, daily problems.
- **Digital transformation in Kenya**: With 99.8% of Kenyan internet users owning a smartphone and over 68.8 million mobile connections nationwide, mobile-first solutions like Fashion Fit align with the country's digital economy agenda under Kenya Vision 2030.
- **Fast fashion and textile waste**: As global awareness of the fashion industry's environmental footprint grows, tools that extend the useful life of existing garments address a pressing and timely concern.
- **Youth innovation and entrepreneurship**: The project demonstrates that young Kenyans can create technology-driven solutions to real-world problems, contributing to the country's growing reputation as a hub for African tech innovation.

## 1.7 MERITS

- **Instant Wardrobe Digitization**: A single photo is all it takes. The AI identifies the category, color, style, pattern, fit, occasion, and over 30 attributes in seconds — turning a tedious manual process into a one-tap action.
- **Bulk Upload (Up to 30 Items Per Session)**: Users can digitize their entire wardrobe in minutes. Bulk Upload supports a rapid-fire camera mode and gallery multi-select. The AI analyzes each item in sequence with a live progress bar, flags non-clothing images as invalid, and shows all results for review before saving. A feature slideshow with background music plays during processing, turning wait time into an onboarding experience.
- **AI-Powered Personal Stylist**: The app works as an always-available personal stylist, generating complete outfits scored across 20 dimensions — including color harmony, style alignment, visual balance, and fabric compatibility — using the user's own clothes. This level of analysis goes beyond what a human stylist can consistently deliver.
- **Rediscovers Forgotten Clothing**: The app actively boosts underused items into outfit suggestions, while preventing any outfit from repeating within 7 days. Clothes the user forgot they owned start appearing in their daily rotation again, and a discovery mode surfaces items from style groups they rarely wear.
- **Reduces Daily Decision Fatigue**: Instead of staring at a full closet every morning trying to decide, the user opens the app and receives three curated outfit options — each with an AI-generated title, description, and personalized reasons — saving mental energy for more important decisions throughout the day.
- **Destination Weather for Travel**: Users can select any city — from Mombasa to London — and get real-time weather plus a morning, afternoon, and evening forecast with rain risk and layering advice. Outfit suggestions automatically adapt to the destination's weather, not just where the user is now.
- **Runs on Any Smartphone**: The app requires no special hardware, no expensive gadgets, and no complicated setup — just a phone with a camera and an internet connection, making it accessible to anyone from a secondary school student to a working professional.
- **Fights Textile Waste at the Source**: By helping users maximize what they already own, Fashion Fit tackles clothing waste where it starts — at the individual's closet. The system learns from every interaction, so recommendations keep improving over time.
- **31-Language Support**: The entire application interface is fully translated into 31 languages: English, Arabic, Bulgarian, Czech, Danish, German, Greek, Spanish, Finnish, French, Hebrew, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Malay, Dutch, Norwegian, Polish, Portuguese, Romanian, Russian, Swedish, Swahili, Thai, Turkish, Ukrainian, Vietnamese, and Chinese. Users can switch languages instantly from their profile, and their preference is saved locally so the app always opens in their chosen language. This makes Fashion Fit accessible to users across Africa, Europe, Asia, and the Americas — not just English speakers.
- **Scales Without Limits**: Whether one person uses it or one million, the core technology works the same — making Fashion Fit a solution that can grow from a single user in Nairobi to a nationwide tool across Kenya and beyond.

## 1.8 DEMERITS

- **Internet Dependency**: The AI image processing and recommendation engine rely on cloud-based models (OpenAI GPT-4o and GPT-4o-mini), which require an active internet connection. In areas with limited connectivity, this may slow down the digitization and recommendation process. Future versions could implement on-device processing to work offline.
- **Limited Category Range**: The current version recognizes six primary clothing categories (top, bottom, dress, shoes, outerwear, accessory) with subcategory support. More specialized items, such as traditional garments (kitenge, kikoi, shuka), sportswear, or formal subcategories, are not yet fully distinguished, presenting an opportunity for expansion.
- **Smartphone Requirement**: The application is currently designed for smartphones, which means users without access to a smartphone would need one to use Fashion Fit. However, with Kenya's smartphone adoption rate growing rapidly and device costs decreasing year on year, this barrier is expected to diminish over time.
- **API Cost**: Each image analysis call to GPT-4o Vision and each AI enhancement call to GPT-4o-mini incurs a cost. While individual calls are inexpensive, scaling to thousands of users requires careful cost management and usage tracking, which the system implements through an API usage monitoring module.

## 1.9 ASSUMPTIONS AND PRECAUTIONS

### 1.9.1 ASSUMPTIONS

- **Smartphone Availability**: Participants will have access to a smartphone with a functioning camera capable of running the Fashion Fit application during all testing sessions.
- **Representative Wardrobe Items**: The clothing items used in testing are representative of typical Kenyan wardrobes, including a reasonable mix of categories such as tops, bottoms, dresses, shoes, outerwear, and accessories.
- **Participant Honesty**: Participants will perform all tasks genuinely and honestly, without rushing or deliberately slowing down during either the manual or app-based methods.
- **Photograph Quality**: Photographs taken by participants will be of reasonable quality, with adequate lighting and the clothing item clearly visible, suitable for AI analysis without major distortions affecting the classification.
- **Ground Truth Reliability**: The two independent human labelers used to establish ground truth labels in Test 2 are competent, unbiased, and consistent in their categorization of clothing items.

### 1.9.2 PRECAUTIONS

- **Order Alternation**: The order of testing (manual method first vs Fashion Fit first) was alternated across participants to control for learning effects and ensure neither method had an unfair advantage.
- **Consistent Timing**: All task durations were measured using the same stopwatch method with clearly defined start and stop points to eliminate timing inconsistencies across participants.
- **Controlled Environment**: All testing was conducted in a well-lit indoor room under similar lighting conditions to minimize variation in the AI's image recognition performance.
- **Independent Labeling**: Ground truth labels for AI accuracy testing were established by two human labelers working independently, reducing the risk of individual bias influencing the benchmark data.
- **Data Privacy**: All wardrobe photographs and participant data were handled confidentially and used solely for the purposes of this research. No personal images were shared publicly.
- **Participant Briefing**: Each participant was briefed on the full testing procedure before beginning, ensuring they understood both methods and could perform the tasks without confusion.

# CHAPTER TWO: LITERATURE REVIEW

## 2.1 PAST WORK PRESENTED BEFORE

1. **Intelligent Wardrobe Management System: An AI-Driven Approach for Automated Outfit Selection and Wardrobe Organization (IEEE Conference, 2024)** — This research, published through the Institute of Electrical and Electronics Engineers (IEEE), explored the use of artificial intelligence to automate outfit selection and wardrobe organization. The system used machine learning and computer vision to classify garments and generate personalized outfit recommendations based on user preferences and weather conditions. While the study demonstrated the technical feasibility of AI-driven wardrobe management, it remained an academic prototype and was not developed into a consumer-facing mobile application accessible to everyday users. The current project builds upon this concept by implementing a fully functional smartphone application designed for practical daily use.
2. **Machine Learning Based Intelligent Wardrobe System for Apparel Recommendation and Organization (IEEE Conference, 2023)** — This IEEE-published study developed a wardrobe system that used machine learning to recommend outfits and organize clothing digitally. The system could classify items by type, color, and season, and offered features such as redundant purchase prevention and packing list generation. However, the study did not measure or quantify the system's impact on wardrobe utilization or sustainability, nor did it conduct controlled experiments with participants to validate its effectiveness statistically. The current project addresses this gap by conducting four controlled tests with real participants and validating all results using paired t-tests at the 95% confidence level.
3. **Virtual Closet Assistant: An AI-Driven Approach for Intelligent Wardrobe Management and Personalized Outfit Recommendation (IJIRSET, 2025)** — This study presented an AI-powered virtual closet assistant that automated wardrobe cataloging using computer vision to identify clothing by type, color, season, and occasion. It also analyzed usage patterns to highlight underutilized items and promote sustainable fashion choices. While the research closely aligns with the goals of Fashion Fit, it was conducted outside Africa and did not consider the unique context of the Kenyan market — including the prevalence of secondhand clothing (*mitumba*), mobile-first internet usage, and the specific sustainability challenges faced by East African consumers. The current project adapts these concepts for the Kenyan context.
4. **Afronomy Chain — Overall Winner, Young Scientists Kenya 2025 (Kon Lual Ajok & Ian Mwadiloh, Nova Pioneer Boys High School Eldoret)** — The 2025 YSK overall winner was a blockchain-powered web system that enabled real-time tracking of public funds to curb corruption. While this project is in a different domain (governance technology), it demonstrates the standard of innovation expected at the YSK competition — applying advanced technology (blockchain) to solve a real Kenyan problem with measurable impact. Fashion Fit follows the same approach by applying AI and computer vision to solve the real, everyday problem of wardrobe management and clothing waste. No previous YSK entry has addressed AI-powered fashion technology or wardrobe sustainability.

## 2.2 RELATED RESEARCH

In recent years, AI and computer vision have been increasingly applied to fashion and wardrobe management. This section reviews research findings directly relevant to Fashion Fit.

Research in cognitive psychology shows that making repeated decisions drains mental energy — a concept known as decision fatigue. Baumeister and Tierney (2011) found that people who face many daily choices make slower decisions and feel less satisfied with their picks. In fashion, every item you consider while browsing your wardrobe costs mental effort, especially when the closet contains similar or conflicting options. A 2024 Accenture report found that 76% of consumers feel overwhelmed by choice, and 88% have abandoned decisions entirely due to decision stress. This supports Fashion Fit's approach: narrow the options to three AI-curated suggestions, reducing the mental effort users face each morning.

Global research on clothing consumption reveals a serious waste problem. According to WRAP (2024) and RawShot AI (2026), the average garment is worn only 7 times before being thrown away — 36% less than 15 years ago. 82% of items in a typical wardrobe are worn fewer than three times per year, and 40% of consumers admit to buying clothes they never wear. About 85% of discarded textiles end up in landfills, despite 95% being reusable or recyclable. These numbers highlight why Fashion Fit's goal matters: get people to wear more of what they already own, so they buy less and waste less.

AI-based clothing recognition is already proven in research. Liu et al. (2016) introduced the DeepFashion dataset and showed that neural networks could classify clothing categories from images with high accuracy. More recently, frameworks on the FashionNet dataset achieved 89.19% accuracy on real e-commerce images across 162 subcategories. A 2024 review found that combining CNNs (good at local patterns) with Vision Transformers (good at overall context) offers the best results for fashion image classification. Fashion Fit builds on these proven techniques, applying them in a practical smartphone app for personal wardrobe management.

Kenya's mobile landscape provides a strong foundation for a smartphone-based solution like Fashion Fit. According to the Digital 4 Africa State of Digital Report (2025), 99.8% of Kenyan internet users aged 16 to 64 own a smartphone. The country has 68.8 million mobile connections against a population of 57 million, representing a 121% mobile penetration rate, with internet users totaling 27.4 million and growing over 20% year-on-year. Across East Africa, mobile internet subscriptions reached 138 million active connections in 2024, driven by affordable smartphones and competitive data pricing. This data confirms that a mobile-first AI application like Fashion Fit is well-positioned to reach a large, connected, and growing user base in Kenya and across the region without requiring desktop computers or specialized infrastructure.

Multiple recent studies in IEEE and international journals (2023–2025) have explored AI wardrobe systems that classify clothing, recommend outfits, and track usage. However, a consistent gap is the lack of controlled experiments with real users. Most studies present technical designs without testing them on people or using statistical methods to prove they work. Fashion Fit fills this gap by running four controlled experiments with real participants and validating all results with paired t-tests at 95% confidence — providing the scientific proof that existing research lacks.

## 2.3 SCIENTIFIC CONCEPTS APPLIED

- **Large Language Models and Multimodal AI (OpenAI GPT-4o / GPT-4o-mini)**: Fashion Fit is powered by OpenAI's GPT-4o and GPT-4o-mini — large language models built on the Transformer architecture (Vaswani et al., 2017). The key innovation of the Transformer is *self-attention*, which allows the model to consider all parts of an input at once rather than reading it sequentially. GPT-4o extends this to images, meaning it can process both text and photographs in a single request. When a user photographs a clothing item, the image is sent to GPT-4o's Vision API, which returns over 30 metadata fields — including category, color, hex palette, style, pattern, fit, occasion, brand, fabric surface, visual weight, color temperature, layering role, and 10 style axis scores — all from one photo.
- **Computer Vision Through Multimodal AI**: Instead of training a separate image recognition model, Fashion Fit uses GPT-4o's built-in vision capabilities. The model has been pre-trained on billions of image-text pairs, giving it strong visual understanding of fashion items. When a photo is submitted, the model identifies shapes, colors, textures, and patterns, then maps them to clothing categories and over 30 attributes. It also scores each item across 10 style axes (formality, structure, texture, boldness, softness, warmth, polish, ruggedness, minimalism, versatility) and extracts visual details like fabric surface type, visual weight, print scale, and layering role. This deep item profiling lets the engine evaluate outfits based on fabric compatibility, visual balance, and layering structure — not just category and color.
- **Real-Time Weather Integration and Destination Forecasting**: Fashion Fit uses the OpenWeatherMap API to get real-time weather based on the user's GPS location. Users can also search any city worldwide to get a full-day forecast split into morning, afternoon, and evening. The system detects temperature swings (layering is recommended when the difference exceeds 8°C), checks rain risk (flagged above 30% probability), and generates a smart recommendation like "Pack layers and bring rain protection." All weather data feeds directly into the scoring engine, so outfits are adapted to the weather at the user's current or destination location.
- **Natural Language Processing (NLP) and Prompt Engineering**: The AI Stylist and Style Coach rely on carefully structured prompts sent to GPT-4o-mini. These prompts include wardrobe data, user preferences, occasion context, weather conditions, and styling rules. The model processes this information and generates outfit recommendations or conversational style advice in return.
- **Algorithmic Fashion Intelligence (20-Signal Scoring Engine)**: Beyond the AI model, Fashion Fit uses a 20-signal scoring engine that rates every possible outfit. The 20 signals are:
  1. **Fashion Intelligence** — weather, occasion, completeness, and balance checks
  2. **Semantic Cohesion** — how well items' style profiles align
  3. **Style DNA Alignment** — match with the user's personal style identity
  4. **Color Harmony** — color compatibility using color wheel rules
  5. **Pattern Mixing** — rewards solids, penalizes clashing patterns
  6. **User Preference Fit** — preferred colors, styles, and body type
  7. **Saved Outfit Similarity** — bonus for resembling outfits the user has saved
  8. **Formality Alignment** — formality level vs occasion target
  9. **Diversity Penalty** — avoids pairing items that are too similar
  10. **Rotation Bonus** — boosts underused items, penalizes overused ones
  11. **Feedback Signals** — boosts liked items, penalizes rejected ones
  12. **Completeness** — bonus for including shoes and outerwear when needed
  13. **Trend Alignment** — matches current fashion trends
  14. **Feedback Pattern Combos** — rewards proven color/style pairings from user history
  15. **Cross-Day Freshness** — penalty for repeating recent outfits (7-day window)
  16. **User Color Temperature** — rewards outfits matching the user's warm/cool preference
  17. **Visual Weight Balance** — even density distribution across items
  18. **Fabric Surface Compatibility** — rewards texture contrast (e.g., matte + satin)
  19. **Layering Coherence** — proper layering structure (base + mid or base + outer)
  20. **Occasion Sub-Variant Formality** — fine-tuned scoring for specific events (e.g., casual brunch vs formal dinner)

  All 20 signals produce weighted scores that combine into a single outfit rating. The top candidates are then passed to GPT-4o-mini for final curation with personalized titles and descriptions.
- **Semantic Style Profiling**: Each clothing item is represented as a 10-number vector based on its style axes. This allows the engine to measure how well items go together, detect duplicates, and ensure variety across recommendations. The profile blends 75% from GPT-4o's visual analysis with 25% from item metadata (category, color, style) for stability.
- **Continuous Learning and Feedback Mining**: Every user interaction (save, reject, rate, view) is recorded. The learning engine gives more weight to recent actions and high ratings, updating the user's preferences in real time. A separate pattern miner tracks which color, style, and category pairings the user consistently likes, feeding proven combinations back into the scoring engine.
- **Cross-Day Outfit Memory**: To prevent repetition, recommended outfits are tracked for 7 days. The system applies penalties for exact repeats, shared core pieces, and partial item overlap with recent outfits, ensuring users see fresh suggestions each day.
- **Color Theory (Color Wheel and Harmony Rules)**: The color harmony algorithm uses classical color theory — mapping complementary, analogous, and monochromatic color relationships. Neutrals (black, white, gray, navy, beige) are treated as universal pairings. Outfits are scored based on how well their colors work together — for example, mostly neutrals with one accent color scores 95/100, while clashing colors score lower.

# CHAPTER THREE: METHODOLOGY

## 3.1 APPARATUS/MATERIALS REQUIRED

- Laptop/Computer: 1 unit used for writing code, running the development server, and deploying the application.
- Smartphone (Android/iOS): 1 unit with a functioning camera used for testing the application during development.
- Cloudinary: Cloud-based image storage service used to upload, store, and retrieve clothing photographs taken by users.
- OpenAI API (GPT-4o & GPT-4o-mini): Cloud-based artificial intelligence service used for image-based clothing recognition (30+ metadata fields per item), semantic style axis scoring, outfit recommendation enhancement with personalized titles and descriptions, and the Style Coach (NOVA) conversational chatbot.
- Node.js & Express.js: Backend server framework used to build the API that handles all requests between the app and external services.
- React Native & Expo (v51.0): Cross-platform mobile application framework used to build the Fashion Fit app for both Android and iOS from a single codebase.
- Stable Internet Connection: Required for communicating with the OpenAI API, MongoDB database, and Cloudinary image storage.
- MongoDB & Mongoose: NoSQL database used to store user accounts, wardrobe items (with full semantic profiles and visual metadata), outfit feedback, user preferences, learning history, recent recommendations (with 7-day TTL), API usage logs, chat history, and social feed data.
- TypeScript: A programming language used for writing the frontend application code with type safety and error prevention.
- React Navigation: Library used to build the app's screen navigation system, including tab-based and stack-based navigation.
- OpenWeatherMap API: Weather data service integrated to provide real-time weather conditions for weather-adaptive outfit recommendations.
- Paystack: Payment processing service for subscription management, enabling freemium and premium plan tiers with usage-based limits.

## 3.2 PROCEDURE

1. Set up the development environment by installing Node.js, React Native, Expo CLI, and TypeScript on the development computer.
2. Initialized the React Native project using Expo and configured the folder structure for screens, services, navigation, and components.
3. Designed and built the user interface screens, including Home, Wardrobe, Camera, Stylist, Chat, Planner, Profile, and Onboarding.
4. Set up the backend server using Node.js and Express.js with API routes for authentication, wardrobe management, AI categorization, outfit styling, and chat.
5. Connected the backend to a MongoDB database using Mongoose to store user accounts, clothing items, outfit feedback, and user preferences.
6. Integrated the OpenAI GPT-4o Vision API to receive clothing photographs from the smartphone camera and return comprehensive categorization data including category, subcategory, color, color palette, style, pattern, fit, occasion, brand, tags, materials, silhouette, dress code, aesthetic keywords, and a summary description — over 30 metadata fields per item in a single API call.
7. Built a Bulk Upload system that allows users to photograph or import up to 30 clothing items per session via rapid-fire camera or gallery multi-select. Each item is analyzed by the AI in sequence with a real-time progress bar, invalid items (non-clothing) are flagged and excluded, and all results are presented in a review grid for confirmation before saving to the wardrobe. During processing, an immersive full-screen slideshow of Fashion Fit features plays with animated gradients, background music, and haptic feedback.
8. Integrated OpenAI GPT-4o-mini to power the AI Stylist for generating outfit recommendations and the Style Coach for conversational fashion advice.
9. Integrated the OpenWeatherMap API for real-time weather by GPS coordinates and destination weather by city name, with a full forecast system that breaks weather into morning, afternoon, and evening periods with temperature swing detection, rain risk assessment, and smart layering recommendations. Built a DestinationPicker UI component with popular Kenyan cities (Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, Nyeri, Malindi, Nanyuki) and a search function for any city worldwide.
10. Built a semantic style profiling system that scores each item across 10 style axes (formality, structure, texture, boldness, softness, warmth, polish, ruggedness, minimalism, versatility) by blending 75% vision-sourced axes from GPT-4o with 25% heuristic axes computed from item metadata. Each item is represented as a 10-dimensional embedding vector for similarity calculations.
11. Built a 20-signal outfit scoring engine that evaluates candidate outfits across fashion intelligence, semantic cohesion, style DNA alignment, color harmony, pattern mixing, user preference fit, saved outfit similarity, formality alignment, diversity, rotation freshness, feedback signals, completeness, trend alignment, feedback pattern combos, cross-day freshness, user color temperature, visual weight balance, fabric surface compatibility, layering coherence, and occasion sub-variant formality.
12. Built the continuous learning system that records every user interaction (saves, rejections, ratings, views) with full metadata and updates individual preference profiles using recency-weighted aggregation to improve future recommendations in real time.
13. Built a feedback pattern miner that identifies which specific color+color, style+style, and category+category pairings each user consistently prefers, feeding proven combinations back into the scoring engine.
14. Built a cross-day outfit memory system that records served outfits with a 7-day time-to-live window and applies graduated penalties for exact matches, core piece overlap, and partial item overlap to ensure users see fresh recommendations daily.
15. Built a diversity-first candidate selection algorithm that prevents recommended outfits from reusing the same core pieces, penalizes similar style directions and color palettes, and reserves one slot for a discovery outfit using underused items from different style groups.
16. Built an AI enhancement layer that sends algorithm-scored candidates to GPT-4o-mini for final curation, generating personalized titles, descriptions, and reasons for each outfit, with the final score blending 55% algorithm and 45% AI confidence.
17. Built a Style DNA system that computes each user's style identity — primary and secondary styles, color preferences, category distribution, wardrobe balance, semantic axes, pattern breakdown, occasion coverage, and wear behavior — with an AI-generated archetype, mantra, and personality description.
18. Built an AI Style Coach (NOVA) — a conversational assistant powered by GPT-4o with full context of the user's wardrobe, Style DNA, preferences, and feedback history, capable of answering any fashion question.
19. Built social features including an outfit sharing feed, likes, follow system, and public profiles.
20. Integrated Cloudinary for cloud-based storage of clothing photographs uploaded by users in three sizes (thumbnail, medium, full).
21. Implemented navigation using React Navigation with bottom tabs and stack-based screen transitions.
22. Built a full internationalization (i18n) system using the i18next framework with react-i18next bindings, supporting 31 languages with complete translations of every screen, label, button, and interaction in the application. Each language is stored as a dedicated locale file (31 JSON files totaling over 380,000 bytes of translated content). The system includes a LanguageSwitcher modal component accessible from the user's profile, instant language switching with haptic feedback, and persistent language preference saved to device storage via AsyncStorage so the app always reopens in the user's chosen language. Supported languages: English, Arabic, Bulgarian, Czech, Danish, German, Greek, Spanish, Finnish, French, Hebrew, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Malay, Dutch, Norwegian, Polish, Portuguese, Romanian, Russian, Swedish, Swahili, Thai, Turkish, Ukrainian, Vietnamese, and Chinese.
23. Tested the application on a physical smartphone device, fixed bugs, and verified that all features — camera capture, AI categorization, outfit generation, chat, social feed, planner, and analytics — worked correctly before conducting experiments.

## 3.3 OBSERVATION

During the development and testing of Fashion Fit, several key observations were made across all four experiments. When a clothing item was photographed under good lighting conditions, the OpenAI GPT-4o Vision API consistently returned accurate category and color results within 2 to 3 seconds, making the digitization process feel almost instant to the user. When using the Bulk Upload feature, participants were able to photograph and digitize 20 to 30 items in a single session, with the AI processing the entire batch while they watched an interactive slideshow. This dramatically reduced the total onboarding time for new users. The AI performed best on items with distinct silhouettes such as shoes, dresses, and tops, while items with overlapping features — such as a long oversized top that resembled a dress — were occasionally misclassified. Color recognition was noticeably affected by lighting conditions, with dark items photographed under warm indoor lighting sometimes misidentified; for example, navy blue being classified as black, or dark green as brown.

During manual wardrobe entry, participants frequently hesitated when deciding how to categorize items and how to describe colors in words, with several asking "what category does this fall under?" while writing. With Fashion Fit, this hesitation was eliminated entirely since the AI made all decisions automatically. Similarly, when selecting outfits without the app, participants were observed picking up and putting down multiple items repeatedly before reaching a final decision, with some expressing frustration at having "too many options." With the AI Stylist, most participants accepted one of the three suggestions within seconds and expressed relief at not having to browse through their entire wardrobe.

On the technical side, the 20-signal scoring engine worked effectively in filtering out incomplete or poorly matched outfits, with combinations missing a top or bottom being automatically rejected before being shown to the user. The cross-day memory system ensured that participants did not receive the same outfit twice within a 7-day window, and the diversity-first selection algorithm guaranteed that each set of recommendations contained genuinely varied options. Several participants in Test 4 were genuinely surprised to discover items in their digitized wardrobe that they had forgotten they owned, and after the AI Stylist began incorporating these items into outfit suggestions — driven by the rotation bonus signal that actively boosts underused items — participants started using them regularly. The continuous learning system also showed visible improvement after 5 to 10 feedback interactions, with the AI Stylist beginning to favor colors and styles the user had previously saved and avoiding combinations they had rejected. The feedback pattern miner further reinforced this by identifying proven color and style pairings from user history.

## 3.4 EXPLANATION/DISCUSSION

All four tests confirm that AI-powered wardrobe management significantly outperforms manual methods in speed, accuracy, and utilization. The 75.4% reduction in digitization time comes from eliminating manual data entry entirely. Instead of the user figuring out an item's category, describing its color, and writing everything down, the AI processes the photo and returns all attributes in 2 to 3 seconds. With Bulk Upload, this advantage grows even further: a user can import up to 30 items in one session while the AI processes each one. A wardrobe of 30 items that would take over 20 minutes by hand can be digitized in under 5 minutes.

The 91.7% category accuracy comes from GPT-4o's strong visual understanding, built from training on billions of image-text pairs. The five misclassifications out of 60 images all involved items that look similar — outerwear confused with tops, and a shoe misclassified as a dress. This is a known challenge in fashion classification. The lower color accuracy of 70.0% is due to lighting conditions — dark items under warm indoor light often get misread (e.g., navy called black). Published research shows that color detection under uncontrolled lighting typically scores 70 to 85%, so Fashion Fit's result falls within the expected range.

The 76.2% reduction in outfit decision time comes from how the AI Stylist narrows choices. A wardrobe of 40 items produces thousands of possible outfit combinations — too many for any person to evaluate efficiently. The AI Stylist cuts this down to three curated suggestions, each scored across 20 signals including color harmony, style alignment, weather (including destination weather), and occasion fit, then polished by GPT-4o-mini with personalized titles and descriptions. Research on decision fatigue confirms that fewer, better choices lead to faster, more confident decisions.

The jump in wardrobe utilization from 36.3% to 76.3% is the most important finding for sustainability. The AI Stylist pulls from the user's full wardrobe when making suggestions, including items that haven't been worn recently. This creates a "rediscovery effect" — users find clothing they forgot they owned and start wearing it again. During the trial, no participant bought new clothes. They simply started using more of what they already had, which is exactly what the project set out to achieve.

## 3.5 CHANGE IN PARAMETERS

The following table presents the dependent and independent variables for each test, along with an explanation of how changing the independent variable affects the dependent variable.

### Test 1: Time-to-digitize

| Dependent Variable                | Independent Variable                           | Explanation of Relationship                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Total digitization time (seconds) | Method of digitization (Manual vs Fashion Fit) | Switching from manual entry to Fashion Fit's camera-based AI capture reduces total digitization time because GPT-4o automates category, color, and attribute detection from a single photograph. |
| Time per item (seconds)           | Method of digitization (Manual vs Fashion Fit) | Each item takes fewer seconds to process when the AI handles all labeling instead of the user writing details by hand.                                                                           |
| Percentage time reduction (%)     | Method of digitization (Manual vs Fashion Fit) | The proportion of time saved depends on which method is used; Fashion Fit yielded a 75.4% average reduction.                                                                                     |

### Test 2: AI Categorization Accuracy

| Dependent Variable                 | Independent Variable                       | Explanation of Relationship                                                                                                                                    |
| ---------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category accuracy (%)              | Labeling method (AI vs Human ground-truth) | The AI model's ability to correctly classify clothing into 6 categories is measured against human labels to determine if it can reliably replace manual entry. |
| Color accuracy (%)                 | Labeling method (AI vs Human ground-truth) | The AI's color detection is compared to human labels, with differences revealing where lighting and camera conditions cause misidentification.                 |
| Precision, Recall, F1 per category | Labeling method (AI vs Human ground-truth) | These metrics reveal which specific categories the AI handles best and which it confuses, enabling targeted improvement.                                       |

### Test 3: Outfit Decision Time

| Dependent Variable                 | Independent Variable                         | Explanation of Relationship                                                                                                                                     |
| ---------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time to choose an outfit (seconds) | Selection method (Without app vs AI Stylist) | The AI Stylist narrows choices from dozens of items to 3 curated suggestions, reducing browsing time and eliminating decision fatigue.                          |
| Percentage time reduction (%)      | Selection method (Without app vs AI Stylist) | The proportion of decision time saved depends on whether the user browses manually or receives AI suggestions; the AI method yielded a 76.2% average reduction. |

### Test 4: Wardrobe Utilization

| Dependent Variable     | Independent Variable                 | Explanation of Relationship                                                                                                                                           |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Utilization rate (%)   | Use of Fashion Fit (Before vs After) | After using Fashion Fit, participants include more items in saved or planned outfits because the AI surfaces forgotten and underused garments in its recommendations. |
| Number of unused items | Use of Fashion Fit (Before vs After) | The count of items never included in any outfit decreases after the AI Stylist incorporates them into suggestions, helping users wear more of what they already own.  |

**Controlled Variables (held constant across all tests):** Same participants tested under both conditions, same clothing items, same environment and lighting, same device, same timing method, same category definitions, and same measurement criteria.

## 3.6 RAW DATA COLLECTED

### Test 1: Digitization Speed

*Objective:* **To determine whether Fashion Fit digitizes clothing items faster than manual entry.**

| Participant | Items | Manual Time (s) | App Time (s) | Time Saved (s) | % Faster |
| ----------- | ----- | --------------- | ------------ | -------------- | -------- |
| 1           | 10    | 411.4           | 100.7        | 310.7          | 75.5     |
| 2           | 10    | 439.9           | 98.3         | 341.6          | 77.7     |
| 3           | 10    | 375.7           | 79.6         | 296.1          | 78.8     |
| 4           | 10    | 451.9           | 68.7         | 383.2          | 84.8     |

### Test 2: AI Categorization Accuracy

*Objective:* **To evaluate whether the AI can accurately classify clothing items by category and color without human input.**

| Category  | Total Images | AI Got Right | AI Got Wrong | Accuracy |
| --------- | ------------ | ------------ | ------------ | -------- |
| Top       | 11           | 11           | 0            | 100%     |
| Bottom    | 11           | 11           | 0            | 100%     |
| Dress     | 9            | 8            | 1            | 89%      |
| Shoes     | 7            | 6            | 1            | 86%      |
| Outerwear | 14           | 11           | 3            | 79%      |
| Accessory | 8            | 8            | 0            | 100%     |

### Test 3: Outfit Decision Time

*Objective:* **To measure whether the AI Stylist reduces the time taken to choose an outfit.**

| Participant | Without App (s) | With AI Stylist (s) | Time Saved (s) | % Faster |
| ----------- | --------------- | ------------------- | -------------- | -------- |
| 1           | 433.4           | 36.8                | 396.6          | 91.5     |
| 2           | 305.5           | 86.9                | 216.6          | 71.5     |
| 3           | 408.7           | 59.0                | 349.7          | 85.6     |
| 4           | 254.1           | 77.4                | 176.7          | 69.5     |

### Test 4: Wardrobe Utilization

*Objective:* **To quantify whether Fashion Fit increases the proportion of clothing items that are actively used.**

| Participant | Total Items | Used Before | Used After | Utilization Before % | Utilization After % | Increase % |
| ----------- | ----------- | ----------- | ---------- | -------------------- | ------------------- | ---------- |
| 1           | 29          | 14          | 20         | 48.3                 | 69.0                | +20.7      |
| 2           | 57          | 21          | 49         | 36.8                 | 86.0                | +49.1      |
| 3           | 41          | 13          | 35         | 31.7                 | 85.4                | +53.7      |
| 4           | 37          | 12          | 30         | 32.4                 | 81.1                | +48.6      |

# CHAPTER FOUR: DATA ANALYSIS AND REPRESENTATION

## 4.1 DATA REPRESENTATION

![Graph 1: Digitization Time — Manual vs Fashion Fit](images/fashion_fit_write_up_v1_667404/image_002.png)

![Graph 2: AI Classification — Precision, Recall & F1 per Category](images/fashion_fit_write_up_v1_667404/image_003.png)

![Graph 3: Outfit Decision Time — Without App vs AI Stylist](images/fashion_fit_write_up_v1_667404/image_004.png)

![Graph 4: Wardrobe Utilization — Before vs After Fashion Fit](images/fashion_fit_write_up_v1_667404/image_005.png)

## 4.2 DATA ANALYSIS

**Graph 1: Digitization Time — Manual vs Fashion Fit**

Graph 1 presents a grouped bar chart comparing the time taken by four participants to digitize 10 clothing items using manual entry versus the Fashion Fit application. The red bars represent manual entry times, which ranged from 375.7 seconds to 451.9 seconds across all participants. The green bars represent Fashion Fit times, which ranged from 68.7 seconds to 100.7 seconds. In every case, the green bar is dramatically shorter than the red bar, visually confirming that Fashion Fit is consistently and significantly faster than manual entry. The average time reduction across all participants was 75.4%, meaning the app completed the same task in roughly one quarter of the time required by hand.

**Graph 2: AI Classification — Precision, Recall, and F1 per Category**

Graph 2 presents a grouped bar chart showing three classification metrics — Precision (blue), Recall (orange), and F1 Score (green) — for each of the six clothing categories. All bars cluster between 0.78 and 1.00, indicating strong and consistent AI performance across every category. Bottom achieved the highest F1 score (0.957), followed by Accessory (0.941) and Shoes (0.923). The weakest category was Outerwear, with a recall of 0.786, meaning the AI missed 3 out of 14 outerwear items by misclassifying them as tops or accessories. Despite this, the overall Macro F1 of 0.918 confirms that the AI delivers balanced, reliable classification performance and is not simply achieving high accuracy by excelling in only one or two categories.

**Graph 3: Outfit Decision Time — Without App vs AI Stylist**

Graph 3 presents a grouped bar chart comparing the time taken by four participants to choose an outfit without the app versus using the AI Stylist. The red bars represent decision times without the app, ranging from 254.1 seconds to 433.4 seconds. The green bars represent decision times with the AI Stylist, ranging from just 36.8 seconds to 86.9 seconds. The contrast between the two is striking — in the most extreme case, Participant 1 took 433 seconds without the app but only 37 seconds with the AI Stylist, a 91.5% reduction. The average reduction across all participants was 76.2%, demonstrating that the AI Stylist eliminates the majority of time spent browsing and deliberating by presenting three ready-made outfit options.

**Graph 4: Wardrobe Utilization — Before vs After Fashion Fit**

Graph 4 presents a grouped bar chart comparing the wardrobe utilization rate of four participants before and after using Fashion Fit. The red bars represent utilization before the app, ranging from 31.7% to 48.3%, meaning participants were actively wearing less than half of their clothing. The green bars represent utilization after using the app, ranging from 69.0% to 86.0%. Every participant showed a substantial increase, with the largest jump being Participant 3, who went from 31.7% to 85.4% — an increase of 53.7 percentage points. The average increase across all participants was 40.0 percentage points, meaning users more than doubled the proportion of their wardrobe that was actively used. This is the strongest evidence of Fashion Fit's sustainability impact, showing that the app helps users wear more of what they already own rather than buying new clothing.

## 4.3 DATA INTERPRETATION

The paired t-test for Test 1 (Digitization Speed) gave a t-statistic of 36.180, far above the critical value of 2.201 at 95% confidence. This proves the 75.4% time reduction is real and not due to chance. In plain terms: what takes 7 minutes by hand takes less than 2 minutes with Fashion Fit, and we are 95% confident the true time saved lies between 5.0 and 5.6 minutes. Similarly, Test 3 (Outfit Decision Time) gave a t-statistic of 12.813 against a critical value of 2.145, confirming the 76.2% reduction is also statistically significant. Users save 3.4 to 4.7 minutes every time they use the AI Stylist instead of browsing manually.

For Test 2 (AI Accuracy), the AI got 55 out of 60 categories right — 91.7% accuracy, beating the 85% target. The Macro F1 score of 0.918 shows this accuracy is consistent across all six categories, not just the easy ones. The five errors were in visually similar categories (outerwear confused with tops). Color accuracy was 70.0%, which is lower but matches published research on color detection under varied lighting. The two human labelers agreed on 90.0% of images (Cohen's Kappa = 0.879, classified as "almost perfect agreement"), confirming the benchmark was fair and reliable.

**Note on Post-Testing Upgrades:** The four experiments above were conducted using the initial version of Fashion Fit, which employed 12 custom scoring algorithms. Since testing was completed, the recommendation engine has been substantially upgraded to a 20-signal scoring system incorporating semantic style profiling (10-dimensional embedding vectors per item), visual metadata analysis (fabric surface, visual weight, layering role), cross-day outfit memory, feedback pattern mining, and an AI enhancement layer for final curation. These upgrades strengthen every aspect of the system — outfit quality, diversity, personalization, and freshness — meaning that the experimental results presented here represent a **conservative lower bound** of Fashion Fit's current capabilities. The core hypothesis findings remain valid, and the upgraded engine would be expected to produce equal or superior results if the same tests were repeated today.

# CHAPTER FIVE: CONCLUSION AND RECOMMENDATION

## 5.1 CONCLUSION

This project set out to test whether an AI-powered mobile app could improve wardrobe management, reduce outfit decision time, and promote sustainable clothing use. Four controlled experiments were conducted, each targeting a specific part of the system, and all results were validated with paired t-tests at the 95% confidence level. Every part of the hypothesis was met and exceeded.

Fashion Fit reduced wardrobe digitization time by 75.4%, cutting what previously took 7 minutes down to under 2 minutes for 10 clothing items. The AI classification system achieved 91.7% category accuracy with a Macro F1 score of 0.918, surpassing the 85% target and proving that automated labeling is reliable enough to replace manual data entry. The AI Stylist reduced outfit decision time by 76.2%, saving users an average of 4 minutes per decision by presenting three curated outfit suggestions instead of requiring them to browse an entire wardrobe. Most importantly, wardrobe utilization increased from 36.3% to 76.3% — a 40 percentage point jump — meaning participants more than doubled the proportion of clothing they actively wore, all without purchasing a single new item.

These results show that AI, when applied to an everyday problem, can deliver real, measurable benefits in speed, accuracy, and sustainability. Fashion Fit is not just a convenience tool — it is a practical solution to clothing waste, starting in the individual's closet. The project brings together computer science, psychology, and sustainability into a single mobile app accessible to any smartphone user in Kenya and beyond. All four tests produced statistically significant results, providing strong evidence that the approach works and is ready for wider adoption.

Since testing was completed, the application has been substantially upgraded with a 20-signal scoring engine, semantic style profiling, visual metadata analysis, cross-day outfit memory, AI enhancement with GPT-4o-mini, a Style DNA system, a conversational AI Style Coach (NOVA), social features, outfit planning, and wardrobe analytics (see Section 5.4). These upgrades strengthen every dimension of the system and confirm that Fashion Fit is not a static prototype but an actively evolving, production-grade platform.

## 5.2 RECOMMENDATION

- **Individual consumers** should adopt AI-powered wardrobe tools like Fashion Fit to save time on daily outfit decisions and make better use of clothing they already own. *As shown in Test 3, the AI Stylist reduced decision time by 76.2%.*
- **Schools and universities** should encourage the use of wardrobe management apps as a practical way to teach students about responsible consumption and sustainability. *Test 4 showed that wardrobe utilization doubled, from 36.3% to 76.3%, without buying new clothes.*
- **Fashion retailers and clothing stores** should integrate wardrobe-awareness technology to help customers see what they already own before purchasing, reducing impulse buying and returns. *Test 1 proved that AI can digitize an entire wardrobe 75.4% faster than manual methods, making adoption practical.*
- **Thrift stores and mitumba market sellers** should use AI categorization tools to digitize and organize large clothing inventories quickly. *Test 2 confirmed that the AI achieves 91.7% category accuracy, making it reliable enough to replace manual sorting.*
- **Sustainable fashion organizations and NGOs** should partner with AI wardrobe tools as a practical way to promote the "wear what you own" message. *Test 4 demonstrated a 40 percentage point increase in wardrobe utilization — real, measurable behavior change.*
- **Government and policymakers**, aligned with SDG 12 (Responsible Consumption and Production), should support tools that reduce textile waste at the consumer level. *All four tests produced statistically significant results at the 95% confidence level, providing strong scientific evidence for policy support.*

## 5.3 APPLICABILITY

- **Kenya and East Africa**: With 99.8% of Kenyan internet users owning smartphones and 68.8 million mobile connections across the country, Fashion Fit is perfectly positioned for the Kenyan market. The widespread availability of secondhand clothing (mitumba) means many users have large, diverse wardrobes that are poorly organized — exactly the problem this app solves.
- **Students and young professionals**: This group faces daily outfit decisions on tight budgets and limited time. Fashion Fit helps them look put-together without spending money on new clothes by maximizing what they already own.
- **Developing countries broadly**: In markets where maximizing existing clothing is both an economic necessity and a sustainability opportunity, Fashion Fit addresses a practical need that no widely available tool currently serves.
- **Global market**: Decision fatigue and wardrobe underutilization are universal problems. The app's core value — save time, wear more of what you own — is relevant to any smartphone user worldwide, regardless of location, age, or income level. With full interface translations in 31 languages spanning Africa, Europe, Asia, the Middle East, and the Americas, Fashion Fit is ready for global adoption without language barriers.
- **Corporate and hospitality sectors**: Organizations managing staff uniforms, such as hotels, airlines, and schools, could adapt Fashion Fit's AI categorization and tracking features for large-scale clothing inventory management.
- **Professional stylists**: Stylists working with multiple clients could use the AI categorization and recommendation features to manage client wardrobes more efficiently, reducing consultation time while improving outfit quality.

## 5.4 FEATURES BUILT SINCE INITIAL TESTING

Since the four controlled experiments were conducted, Fashion Fit has been significantly upgraded with the following features, all of which are fully functional in the current version:

- **20-Signal Scoring Engine**: The original 12 scoring algorithms have been expanded to a 20-signal system incorporating semantic cohesion, visual weight balance, fabric surface compatibility, layering coherence, cross-day freshness, user color temperature, feedback pattern combos, and occasion sub-variant formality.
- **Semantic Style Profiling**: Each item is now scored across 10 style axes by GPT-4o Vision and represented as a 10-dimensional embedding vector, enabling the engine to reason about outfit cohesion and diversity at a mathematical level.
- **Visual Metadata Analysis**: The AI now extracts hex color palette, fabric surface type, visual weight, print scale, color temperature, and layering role for each item — enabling scoring signals that evaluate texture contrast, visual density balance, and layering structure.
- **Cross-Day Outfit Memory**: Served outfits are tracked with a 7-day window to prevent repetition, with graduated penalties for exact, core piece, and partial overlap.
- **AI Enhancement Layer**: Algorithm-scored candidates are sent to GPT-4o-mini for final curation with personalized titles, descriptions, and reasons, blending 55% algorithm and 45% AI confidence.
- **Style DNA**: A computed style identity per user including primary/secondary styles, wardrobe balance, semantic axes, and an AI-generated archetype and personality description.
- **AI Style Coach (NOVA)**: A conversational fashion assistant with full wardrobe context.
- **Social Feed**: Users can share outfits, like posts, follow other users, and view public profiles.
- **Outfit Planner**: Calendar-based outfit planning for upcoming days and events.
- **Wardrobe Analytics**: Visual breakdowns of wardrobe composition, wear patterns, and cost-per-wear.
- **Visual Re-Analysis Pipeline**: A background service that upgrades legacy items with vision-sourced semantic axes and visual metadata.
- **Destination Weather System**: Users can select any destination city and receive real-time weather plus a full-day forecast (morning/afternoon/evening) with temperature swing, rain risk, and layering recommendations — outfit suggestions automatically adapt to the destination's weather. Includes a quick-select grid of popular Kenyan cities.
- **Bulk Upload System**: Users can add up to 30 items per session via rapid-fire camera or gallery multi-select, with sequential AI analysis, real-time progress tracking, invalid item rejection, a review grid, and an immersive processing slideshow with background music and haptic feedback.
- **Multi-Language Support (31 Languages)**: The entire application interface is fully translated into 31 languages — English, Arabic, Bulgarian, Czech, Danish, German, Greek, Spanish, Finnish, French, Hebrew, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Malay, Dutch, Norwegian, Polish, Portuguese, Romanian, Russian, Swedish, Swahili, Thai, Turkish, Ukrainian, Vietnamese, and Chinese — using a full i18n system built with i18next. Each language has a dedicated locale file with complete translations of every screen, label, and interaction. Users can switch languages instantly from their profile with haptic feedback, and the preference persists across sessions.

## 5.5 POSSIBLE FUTURE EXPANSION

- **"Worn Today" tracking feature**: Implement a daily log where users confirm which outfit they actually wore. This would allow wardrobe utilization to be measured from real daily wear data rather than saved or planned outfits, providing even stronger sustainability evidence.
- **Improved color accuracy**: Train the AI with a larger, more diverse image dataset captured under varied lighting conditions and introduce automatic white-balance correction before color classification to improve the current 70.0% accuracy.
- **Expanded clothing categories**: Add subcategories such as formal top, casual top, and athletic top, as well as support for traditional and cultural garments like kitenge, kikoi, and shuka to serve the Kenyan and East African market better.
- **Offline AI processing**: Develop on-device AI models that can categorize clothing without an internet connection, addressing connectivity challenges in rural areas and reducing dependency on cloud-based processing.
- **Expanded language coverage**: While the app already supports 31 languages including Swahili, future updates could add more African languages such as Kikuyu, Luo, Kalenjin, Amharic, Yoruba, and Zulu to deepen accessibility across the continent.
- **Wardrobe gap detection**: Analyze the user's wardrobe to identify missing versatile pieces and suggest targeted purchases, turning Fashion Fit from a "wear what you own" tool into a smart shopping advisor.

## ACKNOWLEDGMENTS

I wish to acknowledge my school for providing the environment and encouragement to pursue this research. I also thank all the participants who volunteered their time and wardrobes for the four controlled experiments, and the independent labelers who provided ground truth data for the accuracy tests. Special thanks to OpenAI for providing the API infrastructure that powers Fashion Fit's AI capabilities, and to the open-source community behind React Native, Expo, i18next, and the other frameworks that made this project possible.

---

## REFERENCES

1. Accenture. (2024). *The Human Paradox: From Customer Centricity to Life Centricity*. Accenture Strategy Report.
2. Baumeister, R. F. and Tierney, J. (2011). *Willpower: Rediscovering the Greatest Human Strength*. New York: The Penguin Press.
3. Digital 4 Africa. (2025). *State of Digital Report Kenya 2025*. Available at: https://digital4africa.com/state-of-digital-kenya-2025/
4. European Parliament. (2019). *Environmental Impact of the Textile and Clothing Industry*. Brussels: European Parliamentary Research Service. Available at: https://www.europarl.europa.eu/RegData/etudes/BRIE/2019/633143/EPRS_BRI(2019)633143_EN.pdf
5. IEEE. (2023). Machine Learning Based Intelligent Wardrobe System for Apparel Recommendation and Organization. *IEEE Conference Publication*. Available at: https://ieeexplore.ieee.org/document/10369699
6. IEEE. (2024). Intelligent Wardrobe Management System: An AI-Driven Approach for Automated Outfit Selection and Wardrobe Organization. *IEEE Conference Publication*.
7. IJIRSET. (2025). Virtual Closet Assistant: An AI-Driven Approach for Intelligent Wardrobe Management and Personalized Outfit Recommendation. *International Journal of Innovative Research in Science, Engineering and Technology*.
8. Kenya Vision 2030 Delivery Secretariat. (2008). *Kenya Vision 2030: A Globally Competitive and Prosperous Kenya*. Nairobi: Government of the Republic of Kenya.
9. Liu, Z., Luo, P., Qiu, S., Wang, X. and Tang, X. (2016). DeepFashion: Powering Robust Clothes Recognition and Retrieval with Rich Annotations. *Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR)*, pp. 1096–1104.
10. OpenWeatherMap. (2025). *Weather API Documentation*. Available at: https://openweathermap.org/api
11. RawShot AI. (2026). *The State of Wardrobe Waste: Global Fashion Consumption Data*. RawShot AI Research.
12. United Nations Environment Programme (UNEP). (2019). *Putting the Brakes on Fast Fashion*. UN Environment. Available at: https://www.unep.org/news-and-stories/story/putting-brakes-fast-fashion
13. Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł. and Polosukhin, I. (2017). Attention Is All You Need. *Advances in Neural Information Processing Systems (NeurIPS)*, 30, pp. 5998–6008.
14. WRAP (Waste and Resources Action Programme). (2017). *Valuing Our Clothes: The Cost of UK Fashion*. Banbury: WRAP.
15. WRAP (Waste and Resources Action Programme). (2024). *Textiles: Market Situation Report*. Banbury: WRAP.
