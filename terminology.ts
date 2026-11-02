export type DatabaseKey = 'Taxonomy' | 'Target' | 'Stream' | 'Problem';

export interface TerminologyPack {
  id: string;
  displayName: string;
  description: string;
  labels: {
    Taxonomy: { primary: string; descriptive: string };
    Target: { primary: string; descriptive: string };
    Stream: { primary: string; descriptive: string };
    Problem: { primary: string; descriptive: string };
  };
  ui: {
    wizard: {
      step1Title: string;
      step1Prompt: string;
      step1Placeholder: string;
      step1HelpText: string;
      step2Title: string;
      step2Prompt: string;
      step2Placeholder: string;
      step2HelpText: string;
      actionButton: string;
    };
    workspace: {
      explorerTitle: string;
      emptyStateText: string;
      panelHeaderDetails: string;
      addNodeAction: string;
      deleteNodeAction: string;
    };
    analytics: {
      legendTitle: string;
      dependencyWarning: string;
      densityMetricLabel: string;
    };
  };
}

export const TERMINOLOGY_LENSES: Record<string, TerminologyPack> = {
  general_challenge: {
    id: 'general_challenge',
    displayName: 'General Challenge Mapping',
    description: 'Standard terminology for broad systemic investigations and strategic analysis.',
    labels: {
      Taxonomy: { primary: 'Domain', descriptive: 'Macro area of interest' },
      Target: { primary: 'Challenge', descriptive: 'Core problem space' },
      Stream: { primary: 'Research Track', descriptive: 'Vector of inquiry' },
      Problem: { primary: 'Friction Point', descriptive: 'Verified systemic pain point' }
    },
    ui: {
      wizard: {
        step1Title: 'Isolate Challenge Focus',
        step1Prompt: 'What core challenge or systemic bottleneck are you trying to explore?',
        step1Placeholder: 'e.g., Post-retirement knowledge loss and structural isolation',
        step1HelpText: 'This establishes the primary focus boundary for your project investigation.',
        step2Title: 'Identify the Affected Stakeholder',
        step2Prompt: 'Who is experiencing this challenge, and what is the current setting?',
        step2Placeholder: 'e.g., Retiring senior professionals within institutional R&D departments',
        step2HelpText: 'This constraint bounds the downstream research data feeds.',
        actionButton: 'Map Challenge Architecture'
      },
      workspace: {
        explorerTitle: 'Strategic Friction Explorer',
        emptyStateText: 'No research tracks active. Define an initial challenge to begin structural mapping.',
        panelHeaderDetails: 'Friction Node Configuration Properties',
        addNodeAction: 'Append Friction Point',
        deleteNodeAction: 'Sever Node Attachment'
      },
      analytics: {
        legendTitle: 'Challenge Dependency Web',
        dependencyWarning: 'Indicates a point of vulnerability cascading into external system dependencies.',
        densityMetricLabel: 'Friction Density Rating'
      }
    }
  },
  technical_engineering: {
    id: 'technical_engineering',
    displayName: 'Technical & Engineering Diagnostics',
    description: 'Tailored for debugging hardware, embedded firmware, systems architecture, and diagnostics workflows.',
    labels: {
      Taxonomy: { primary: 'Environment', descriptive: 'Host system or hardware boundary' },
      Target: { primary: 'System Problem', descriptive: 'Critical operational bottleneck or failure state' },
      Stream: { primary: 'Data Feed', descriptive: 'Continuous telemetry, testing criteria, or log streams' },
      Problem: { primary: 'Failure Mode', descriptive: 'Root structural defect or edge-case crash condition' }
    },
    ui: {
      wizard: {
        step1Title: 'Define Operational Fault',
        step1Prompt: 'What architectural bottleneck or hardware fault are you diagnosing?',
        step1Placeholder: 'e.g., Bipedal actuator joint torque degradation at high duty cycles',
        step1HelpText: 'This becomes the global root node within your system environment layout.',
        step2Title: 'Isolate System Boundary',
        step2Prompt: 'Under what physical configuration or firmware build is this error appearing?',
        step2Placeholder: 'e.g., ROS2 Jazzy distribution running real-time execution loops under Ubuntu Jammy',
        step2HelpText: 'Used to filter incoming automated log analysis feeds.',
        actionButton: 'Initialize Graph Diagnostic Canvas'
      },
      workspace: {
        explorerTitle: 'System Diagnostic Workstation',
        emptyStateText: 'Telemetry silent. Initialize a telemetry environment track to pipe log events.',
        panelHeaderDetails: 'Telemetry Node Manifest & Failure States',
        addNodeAction: 'Log Failure Mode Component',
        deleteNodeAction: 'Purge Telemetry Node Link'
      },
      analytics: {
        legendTitle: 'Fault Propagation Topology',
        dependencyWarning: 'Critical risk: This failure cascades directly into severe downstream component degradation.',
        densityMetricLabel: 'Failure Propagation Multiplier'
      }
    }
  },
  industrial_design: {
    id: 'industrial_design',
    displayName: 'Human-Centered Design & Innovation',
    description: 'Optimized for intensive product discovery, ergonomic studies, and ethnography.',
    labels: {
      Taxonomy: { primary: 'User Landscape', descriptive: 'Physical or cognitive human context' },
      Target: { primary: 'Design Objective', descriptive: 'Core user friction or unmet space' },
      Stream: { primary: 'Insight Stream', descriptive: 'Observational tracks or user session logs' },
      Problem: { primary: 'User Pain Point', descriptive: 'Direct operational roadblock or friction node' }
    },
    ui: {
      wizard: {
        step1Title: 'Frame Design Opportunity',
        step1Prompt: 'What human frustration or physical constraint needs to be redesigned?',
        step1Placeholder: 'e.g., Tactile grip limitations for arthritic individuals using handheld tools',
        step1HelpText: 'Frames the core ergonomic design objective for your innovation mapping workspace.',
        step2Title: 'Profile the End User',
        step2Prompt: 'Which demographic or physical context is the primary subject of your observation?',
        step2Placeholder: 'e.g., Senior citizens over 65 navigating independent cooking environments',
        step2HelpText: 'Anchors your qualitative observational studies to a definite user context.',
        actionButton: 'Synthesize Innovation Landscape'
      },
      workspace: {
        explorerTitle: 'Empathy & Innovation Canvas',
        emptyStateText: 'Canvas clear. Map your user insights vectors to visually construct pain point hierarchies.',
        panelHeaderDetails: 'User Pain Point Properties & Behavioral Signals',
        addNodeAction: 'Map Behavioral Pain Point',
        deleteNodeAction: 'Prune Extraneous Observation'
      },
      analytics: {
        legendTitle: 'Experience Friction Network',
        dependencyWarning: 'Direct correlation: This roadblock actively drives subsequent negative user frustration.',
        densityMetricLabel: 'Frustration Severity Index'
      }
    }
  }
};
