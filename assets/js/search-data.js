// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-people",
          title: "people",
          description: "current and alumni members",
          section: "Navigation",
          handler: () => {
            window.location.href = "/people/";
          },
        },{id: "nav-research",
          title: "research",
          description: "past and ongoing projects",
          section: "Navigation",
          handler: () => {
            window.location.href = "/research/";
          },
        },{id: "nav-publications",
          title: "publications",
          description: "publications in reversed chronological order",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-talks",
          title: "talks",
          description: "talks by categories in reversed chronological order",
          section: "Navigation",
          handler: () => {
            window.location.href = "/talks/";
          },
        },{id: "nav-teaching",
          title: "teaching",
          description: "past and ongoing courses",
          section: "Navigation",
          handler: () => {
            window.location.href = "/teaching/";
          },
        },{id: "nav-cv",
          title: "cv",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/assets/pdf/minjie_cv.pdf";
          },
        },{id: "post-google-gemini-updates-flash-1-5-gemma-2-and-project-astra",
      
        title: 'Google Gemini updates: Flash 1.5, Gemma 2 and Project Astra <svg width="1.2rem" height="1.2rem" top=".5rem" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M17 13.5v6H5v-12h6m3-3h6v6m0-6-9 9" class="icon_svg-stroke" stroke="#999" stroke-width="1.5" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
      
      description: "We’re sharing updates across our Gemini family of models and a glimpse of Project Astra, our vision for the future of AI assistants.",
      section: "Posts",
      handler: () => {
        
          window.open("https://blog.google/technology/ai/google-gemini-update-flash-ai-assistant-io-2024/", "_blank");
        
      },
    },{id: "post-displaying-external-posts-on-your-al-folio-blog",
      
        title: 'Displaying External Posts on Your al-folio Blog <svg width="1.2rem" height="1.2rem" top=".5rem" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M17 13.5v6H5v-12h6m3-3h6v6m0-6-9 9" class="icon_svg-stroke" stroke="#999" stroke-width="1.5" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
      
      description: "",
      section: "Posts",
      handler: () => {
        
          window.open("https://medium.com/@al-folio/displaying-external-posts-on-your-al-folio-blog-b60a1d241a0a?source=rss-17feae71c3c4------2", "_blank");
        
      },
    },{id: "news-ppel-undergrad-alex-ju-won-the-john-ogden-bigelow-jr-prize-in-electrical-engineering-as-ece-graduating-class-of-2020",
          title: 'PPEL undergrad Alex Ju won the John Ogden Bigelow, Jr. Prize in Electrical...',
          description: "",
          section: "News",},{id: "news-yenan-chen-won-the-best-paper-award-at-the-compel-2020-with-his-paper-two-stage-48v-1v-hybrid-switched-capacitor-point-of-load-converter-with-24v-intermediate-bus-sparkles-smile",
          title: 'Yenan Chen won the Best Paper Award at the COMPEL 2020 with his...',
          description: "",
          section: "News",},{id: "news-yenan-chen-won-the-3rd-tpel-prize-paper-for-ppel-with-his-paper-multicell-reconfigurable-multi-input-multi-output-energy-router-architecture-sparkles-smile",
          title: 'Yenan Chen won the 3rd TPEL prize paper for PPEL with his paper...',
          description: "",
          section: "News",},{id: "news-youssef-elasser-and-jaeil-baek-won-outstanding-student-demonstration-presentation-awards-at-ecce2021-sparkles-smile",
          title: 'Youssef Elasser and Jaeil Baek won outstanding student demonstration presentation awards at ECCE2021!...',
          description: "",
          section: "News",},{id: "news-youssef-elasser-and-jaeil-baek-won-best-paper-awards-at-2021-open-compute-project-global-summit-sparkles-smile",
          title: 'Youssef Elasser and Jaeil Baek won best paper awards at 2021 Open Compute...',
          description: "",
          section: "News",},{id: "news-ping-wang-and-hsin-cheng-won-outstanding-presentation-awards-at-apec2022-sparkles-smile",
          title: 'Ping Wang and Hsin Cheng won outstanding presentation awards at APEC2022! :sparkles: :smile:...',
          description: "",
          section: "News",},{id: "news-hsin-cheng-and-zhiwu-zheng-won-the-best-paper-award-at-the-robosoft-2022-with-their-paper-model-based-control-of-planar-piezoelectric-inchworm-soft-robot-for-crawling-in-constrained-environments",
          title: 'Hsin Cheng and Zhiwu Zheng won the Best Paper Award at the RoboSoft...',
          description: "",
          section: "News",},{id: "news-prof-chen-received-the-e-lawrence-keyes-jr-emerson-electric-co-faculty-advancement-award-from-princeton-school-of-engineering-and-applied-science-sparkles-smile",
          title: 'Prof. Chen received the E. Lawrence Keyes, Jr./Emerson Electric Co. Faculty Advancement Award...',
          description: "",
          section: "News",},{id: "news-hsin-cheng-received-the-best-poster-award-at-the-icra-2022-bio-inspired-and-biohybrid-cyborg-systems-workshop-with-his-paper-bioinspired-inchworm-crawling-and-jumping-of-piezoelectric-soft-robots",
          title: 'Hsin Cheng received the Best Poster Award at the ICRA 2022 Bio-inspired and...',
          description: "",
          section: "News",},{id: "news-ppel-s-undergrad-petru-cotrut-won-the-hisashi-kobayashi-prize-from-princeton-ece",
          title: 'PPEL’s undergrad Petru Cotrut won the Hisashi Kobayashi Prize from Princeton ECE.',
          description: "",
          section: "News",},{id: "news-ping-wang-s-paper-differential-power-processing-for-ultra-efficient-data-storage-won-the-4th-tpel-prize-paper-for-ppel-sparkles-smile",
          title: 'Ping Wang’s paper “Differential Power Processing for Ultra-Efficient Data Storage” won the 4th...',
          description: "",
          section: "News",},{id: "news-prof-minjie-chen-and-prof-charles-sullivan-won-the-5th-tpel-prize-paper-for-ppel-with-their-paper-unified-models-for-coupled-inductors-applied-to-multiphase-pwm-converters-sparkles-smile",
          title: 'Prof. Minjie Chen and Prof. Charles Sullivan won the 5th TPEL prize paper...',
          description: "",
          section: "News",},{id: "news-ppel-undergrad-aneesha-manocha-received-the-prestigiouschurchill-scholarship-for-science-policy-she-will-spend-a-year-studying-at-the-university-of-cambridge-while-living-at-churchill-college",
          title: 'PPEL undergrad Aneesha Manocha received the prestigiousChurchill Scholarship for science policy. She will...',
          description: "",
          section: "News",},{id: "news-daniel-zhou-and-mian-liao-won-the-rao-r-tummala-best-paper-award-at-the-3d-peim-2023-with-their-paper-power-systems-on-chiplet-inductor-linked-multi-output-switched-capacitor-multi-rail-power-delivery-on-chiplets",
          title: 'Daniel Zhou and Mian Liao won the Rao R. Tummala Best Paper Award...',
          description: "",
          section: "News",},{id: "news-tanuj-sen-youssef-elasser-and-shukai-wang-won-outstanding-presentation-awards-at-apec2023-sparkles-smile",
          title: 'Tanuj Sen, Youssef Elasser, and Shukai Wang won outstanding presentation awards at APEC2023!...',
          description: "",
          section: "News",},{id: "news-dr-ping-wang-defended-his-phd-thesis-granular-power-conversion-with-distributed-switching-cells-and-magnetics-integration",
          title: 'Dr. Ping Wang defended his PhD thesis Granular Power Conversion with Distributed Switching...',
          description: "",
          section: "News",},{id: "news-prof-chen-received-the-richard-m-bass-outstanding-young-power-electronics-engineering-award-from-ieee-power-electronics-society-this-award-is-given-annually-to-one-power-electronics-engineer-under-the-age-of-35-internationally-sparkles-smile",
          title: 'Prof. Chen received the Richard M. Bass Outstanding Young Power Electronics Engineering Award...',
          description: "",
          section: "News",},{id: "news-jaeil-baek-and-youssef-elasser-won-the-6th-tpel-prize-paper-with-their-paper-vertical-stacked-lego-pol-cpu-voltage-regulator-sparkles-smile",
          title: 'Jaeil Baek and Youssef Elasser won the 6th TPEL prize paper with their...',
          description: "",
          section: "News",},{id: "news-daniel-zhou-won-the-princeton-graduate-student-award-for-excellence-for-demonstrated-excellence-in-courses-research-and-teaching-during-their-time-at-princeton",
          title: 'Daniel Zhou won the Princeton Graduate Student Award for Excellence for “demonstrated excellence...',
          description: "",
          section: "News",},{id: "news-hsin-cheng-received-the-iros-best-paper-finalist-on-robot-mechanisms-and-design-with-his-paper-eviper-a-scalable-platform-for-untethered-modular-soft-robots",
          title: 'Hsin Cheng received the IROS Best Paper Finalist on Robot Mechanisms and Design...',
          description: "",
          section: "News",},{id: "news-mian-liao-received-the-prestigious-new-jersey-wind-institute-fellowship",
          title: 'Mian Liao received the prestigious New Jersey Wind Institute Fellowship.',
          description: "",
          section: "News",},{id: "news-haoran-li-and-shukai-wang-won-the-best-student-demonstration-award-at-ecce2023",
          title: 'Haoran Li and Shukai Wang won the best student demonstration award at ECCE2023....',
          description: "",
          section: "News",},{id: "news-mian-liao-shukai-wang-and-tanuj-sen-won-outstanding-presentation-awards-at-apec2024-sparkles-smile",
          title: 'Mian Liao, Shukai Wang, and Tanuj Sen won outstanding presentation awards at APEC2024!...',
          description: "",
          section: "News",},{id: "news-daniel-zhou-won-the-ieee-pels-john-kassakian-fellowship",
          title: 'Daniel Zhou won the IEEE PELS John Kassakian Fellowship.',
          description: "",
          section: "News",},{id: "news-dr-youssef-elasser-defended-his-phd-thesis-hybrid-switched-capacitor-circuits-and-magnetics-co-design-for-vertical-power-delivery",
          title: 'Dr. Youssef Elasser defended his PhD thesis Hybrid Switched-Capacitor Circuits and Magnetics Co-Design...',
          description: "",
          section: "News",},{id: "news-ppel-s-undergrad-daniel-simone-won-the-bradley-dickinson-award-for-system-design-awarded-for-outstanding-accomplishments-in-the-design-and-implementation-of-complex-electronic-systems-from-princeton-ece",
          title: 'PPEL’s undergrad Daniel Simone won the Bradley Dickinson Award for System Design, awarded...',
          description: "",
          section: "News",},{id: "news-prof-chen-delivered-a-keynote-speech-on-power-electronics-turing-test-at-compel-2024",
          title: 'Prof. Chen delivered a Keynote Speech on Power Electronics Turing Test at COMPEL...',
          description: "",
          section: "News",},{id: "news-haoran-li-and-shukai-wang-won-the-7th-tpel-prize-paper-for-ppel-with-their-paper-how-magnet-machine-learning-framework-for-modeling-power-magnetic-material-characteristics-sparkles-smile",
          title: 'Haoran Li and Shukai Wang won the 7th TPEL prize paper for PPEL...',
          description: "",
          section: "News",},{id: "news-ppel-s-magnet-project-won-the-2024-power-of-associations-silver-award-from-the-american-society-of-association-executives-asae-for-the-ieee-power-electronics-society-this-is-one-of-the-two-awards-that-was-received-by-ieee-in-2024",
          title: 'PPEL’s MagNet Project won the 2024 Power of Associations Silver Award from the...',
          description: "",
          section: "News",},{id: "news-dr-ping-wang-s-phd-thesis-presentation-received-the-p3-thesis-talk-award-from-the-ieee-power-electronics-society",
          title: 'Dr. Ping Wang’s PhD thesis presentation received the P3 Thesis Talk Award from...',
          description: "",
          section: "News",},{id: "news-mian-liao-konstantinous-manos-davit-grigoryan-and-shukai-wang-won-outstanding-presentation-awards-at-apec2025-sparkles-smile",
          title: 'Mian Liao, Konstantinous Manos, Davit Grigoryan, and Shukai Wang won outstanding presentation awards...',
          description: "",
          section: "News",},{id: "news-daniel-zhou-won-the-best-student-presentation-award-at-the-bell-labs-100-year-anniversary",
          title: 'Daniel Zhou won the best student presentation award at the Bell Labs 100...',
          description: "",
          section: "News",},{id: "news-konstantinous-manos-published-ppel-s-1st-paper-on-nature",
          title: 'Konstantinous Manos published PPEL’s 1st paper on Nature.',
          description: "",
          section: "News",},{id: "news-shukai-wang-received-the-maeder-fellowship-from-princeton-andlinger-center-for-energy-and-the-environment-sparkles-smile",
          title: 'Shukai Wang received the Maeder Fellowship from Princeton Andlinger Center for Energy and...',
          description: "",
          section: "News",},{id: "news-prof-chen-was-invited-to-participate-and-present-at-the-2025-japan-america-frontiers-of-engineering-symposium-sparkles-smile",
          title: 'Prof. Chen was invited to participate and present at the 2025 Japan-America Frontiers...',
          description: "",
          section: "News",},{id: "news-prof-chen-will-deliver-a-keynote-speech-on-interdisciplinary-power-electronics-research-at-compel-2025",
          title: 'Prof. Chen will deliver a Keynote Speech on Interdisciplinary Power Electronics Research at...',
          description: "",
          section: "News",},{id: "projects-daniel-h-zhou",
          title: 'Daniel H. Zhou 🇨🇦',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_danielzhou/";
            },},{id: "projects-davit-grigoryan",
          title: 'Davit Grigoryan 🇦🇲',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_davitgrigoryan/";
            },},{id: "projects-diego-serrano",
          title: 'Diego Serrano 🇪🇸',
          description: "postdoc researcher",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_diegoserrano/";
            },},{id: "projects-elias-veilleux",
          title: 'Elias Veilleux 🇺🇸',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_eliasveilleux/";
            },},{id: "projects-geyong-gu-kang",
          title: 'Geyong-Gu Kang 🇰🇷',
          description: "postdoc researcher",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_gyeonggukang/";
            },},{id: "projects-hanyu-liu",
          title: 'Hanyu Liu 🇨🇳',
          description: "visiting student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_hanyuliu/";
            },},{id: "projects-haoran-li",
          title: 'Haoran Li 🇨🇳',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_haoranli/";
            },},{id: "projects-hsin-cheng",
          title: 'Hsin Cheng 🇹🇼',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_hsincheng/";
            },},{id: "projects-hyukjae-kwon",
          title: 'Hyukjae Kwon 🇰🇷',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_hyukjaekwon/";
            },},{id: "projects-jaeil-baek",
          title: 'Jaeil Baek  🇰🇷',
          description: "postdoc researcher",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_jaeilbaek/";
            },},{id: "projects-jing-yuan",
          title: 'Jing Yuan 🇩🇰',
          description: "visiting student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_jingyuan/";
            },},{id: "projects-konstantinos-manos",
          title: 'Konstantinos Manos 🇬🇷',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_konstantinosmanos/";
            },},{id: "projects-mian-liao",
          title: 'Mian Liao 🇨🇳',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_mianliao/";
            },},{id: "projects-ming-liu",
          title: 'Ming Liu 🇨🇳',
          description: "postdoc researcher",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_mingliu/";
            },},{id: "projects-ping-wang",
          title: 'Ping Wang 🇨🇳',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_pingwang/";
            },},{id: "projects-shukai-wang",
          title: 'Shukai Wang 🇨🇳',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_shukaiwang/";
            },},{id: "projects-steven-zeng",
          title: 'Steven Zeng 🇲🇴',
          description: "postdoc researcher",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_stevenzeng/";
            },},{id: "projects-tanuj-sen",
          title: 'Tanuj Sen 🇮🇳',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_tanujsen/";
            },},{id: "projects-yang-wu",
          title: 'Yang Wu 🇳🇱',
          description: "visiting student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_yangwu/";
            },},{id: "projects-yenan-chen",
          title: 'Yenan Chen 🇨🇳',
          description: "postdoc researcher",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_yenanchen/";
            },},{id: "projects-yifan-rao",
          title: 'Yifan Rao 🇨🇳',
          description: "postdoctoral researcher",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_yifanrao/";
            },},{id: "projects-youssef-elasser",
          title: 'Youssef Elasser 🇺🇸',
          description: "graduate student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_youssefelasser/";
            },},{id: "projects-yueshi-guan",
          title: 'Yueshi Guan 🇨🇳',
          description: "visiting student",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_yueshiguan/";
            },},{id: "projects-yufei-li",
          title: 'Yufei Li 🇨🇳',
          description: "postdoc researcher",
          section: "Projects",handler: () => {
              window.location.href = "/projects/member_yufeili/";
            },},{id: "projects-computing",
          title: 'Computing',
          description: "Jaeil Baek, Youssef Elasser, Haoran Li, Ping Wang",
          section: "Projects",handler: () => {
              window.location.href = "/projects/project_computing/";
            },},{id: "projects-grid",
          title: 'Grid',
          description: "Tanuj Sen, Mian Liao",
          section: "Projects",handler: () => {
              window.location.href = "/projects/project_grid/";
            },},{id: "projects-magnet",
          title: 'MagNet',
          description: "Diego Serrano, Haoran Li, Shukai Wang, Hyukjae Kwon",
          section: "Projects",handler: () => {
              window.location.href = "/projects/project_magnets/";
            },},{id: "projects-radio-frequency",
          title: 'Radio Frequency',
          description: "Daniel Zhou, Ming Liu, Tanuj Sen",
          section: "Projects",handler: () => {
              window.location.href = "/projects/project_rf/";
            },},{id: "projects-robotics",
          title: 'Robotics',
          description: "Konstantinous Manos, Hsin Cheng, Elias Veilleux",
          section: "Projects",handler: () => {
              window.location.href = "/projects/project_robotics/";
            },},{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
