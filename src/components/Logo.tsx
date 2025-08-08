import React from 'react';
import logoSrBigode from '../assets/logo-sr-bigode.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16'
};

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl'
};

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = true, 
  className = '',
  textClassName = ''
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <img 
        src={logoSrBigode} 
        alt="Sr. Bigode" 
        className={`object-contain ${sizeClasses[size]}`}
      />
      {showText && (
        <span className={`font-bold text-current ${textSizeClasses[size]} ${textClassName}`}>
          Sr. Bigode
        </span>
      )}
    </div>
  );
};