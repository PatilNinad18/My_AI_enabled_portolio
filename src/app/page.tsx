import HomeMotion from '@/components/HomeMotion';
import HomeAnchors from '@/components/HomeAnchors';
import PortraitHero from '@/components/PortraitHero';
import ProjectShowcase from '@/components/ProjectShowcase';
import ExperienceTimeline from '@/components/ExperienceTimeline';
import FeatureCards from '@/components/FeatureCards';
import TechnologyMarquees from '@/components/TechnologyMarquees';
import AboutIntro from '@/components/about/AboutIntro';
import { expertise } from '@/content/home';
import styles from '@/styles/portfolio.module.scss';

export default function HomePage() {
  return (
    <div className={styles.shell} data-home>
      <HomeMotion />
      <HomeAnchors />
      <PortraitHero />

      <AboutIntro />

      <FeatureCards id="home-expertise" title="Skills & Expertise" items={expertise} />

      <TechnologyMarquees />

      <ExperienceTimeline />

      <ProjectShowcase />

    </div>
  );
}
