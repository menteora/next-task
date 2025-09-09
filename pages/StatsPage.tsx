import React from 'react';
import { Task } from '../types';
import StatsView from '../components/StatsView';

interface StatsPageProps {
  tasks: Task[];
}

const StatsPage: React.FC<StatsPageProps> = ({ tasks }) => {
  return <StatsView tasks={tasks} />;
};

export default StatsPage;
