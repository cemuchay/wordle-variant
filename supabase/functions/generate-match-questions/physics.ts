import { seededShuffle } from "./utils.ts";

export function generatePhysicsQuestion(
   seed: string,
   entity: any,
   allEntities: any[],
   rng: () => number,
   variant: number,
   proceduralWeight: number = 0.5,
): any {
   const useDB = entity && rng() > proceduralWeight;

   if (!useDB || !entity) {
      // Procedural physics calculations
      const subType = Math.floor(rng() * 6); // 0: Speed, 1: Acceleration, 2: Optics, 3: Ohm's Law, 4: Density, 5: Work

      if (subType === 0) {
         // Speed: v = d / t
         const time = Math.floor(rng() * 15) + 2; // 2 to 16 seconds
         const speedVal = Math.floor(rng() * 10) + 5; // 5 to 14 m/s
         const distance = time * speedVal;

         const correctVal = `${speedVal} m/s`;
         const distractors = [
            `${speedVal} m`,
            `${speedVal} s`,
            `${speedVal} m/s²`,
            `${(speedVal * 1.5).toFixed(0)} m/s`,
            `${(speedVal / 2).toFixed(1)} m/s`,
         ];

         const uniqueDistractors = [...new Set(distractors)].filter(d => d !== correctVal);

         return {
            type: "physics_speed",
            prompt: `A toy car travels a distance of ${distance} meters in exactly ${time} seconds. What is its average speed?`,
            choices: seededShuffle([correctVal, ...uniqueDistractors].slice(0, 4), rng),
            answer: correctVal,
            explanation: `Speed = Distance / Time. So, ${distance} m / ${time} s = ${correctVal}.`,
         };
      }

      if (subType === 1) {
         // Acceleration/Force: F = ma => a = F/m
         const mass = Math.floor(rng() * 8) + 2; // 2 to 9 kg
         const accVal = Math.floor(rng() * 6) + 2; // 2 to 7 m/s²
         const force = mass * accVal;

         const correctVal = `${accVal} m/s²`;
         const distractors = [
            `${accVal} N`,
            `${accVal} kg`,
            `${accVal} m/s`,
            `${(accVal * 2).toFixed(0)} m/s²`,
            `${(accVal / 2).toFixed(1)} m/s²`,
         ];

         const uniqueDistractors = [...new Set(distractors)].filter(d => d !== correctVal);

         return {
            type: "physics_force",
            prompt: `A net force of ${force} N is applied to an object with a mass of ${mass} kg. What is the acceleration of the object?`,
            choices: seededShuffle([correctVal, ...uniqueDistractors].slice(0, 4), rng),
            answer: correctVal,
            explanation: `Acceleration = Force / Mass. So, ${force} N / ${mass} kg = ${correctVal}.`,
         };
      }

      if (subType === 2) {
         // Optics / Mirrors
         const opticsType = Math.floor(rng() * 2);
         if (opticsType === 0) {
            // Law of reflection
            const angleOfIncidence = Math.floor(rng() * 50) + 15; // 15 to 64 degrees
            const correctVal = `${angleOfIncidence}°`;
            const distractors = [
               `${angleOfIncidence} rad`,
               `${90 - angleOfIncidence}°`,
               `${90}°`,
               `${angleOfIncidence + 15}°`,
            ];
            const uniqueDistractors = [...new Set(distractors)].filter(d => d !== correctVal);

            return {
               type: "physics_optics",
               prompt: `A ray of light strikes a flat reflective mirror with an angle of incidence of ${angleOfIncidence}° to the normal. What is the angle of reflection?`,
               choices: seededShuffle([correctVal, ...uniqueDistractors].slice(0, 4), rng),
               answer: correctVal,
               explanation: `According to the law of reflection, the angle of incidence equals the angle of reflection. Both are measured relative to the normal. So the angle is ${correctVal}.`,
            };
         } else {
            // Focal length: f = R/2
            const radius = (Math.floor(rng() * 15) + 5) * 2; // 10 to 38 cm (even numbers)
            const focal = radius / 2;
            const correctVal = `${focal} cm`;
            const distractors = [
               `${focal} m`,
               `${radius} cm`,
               `${focal} cm/s`,
               `${(focal * 2).toFixed(0)} cm`,
               `${(focal / 2).toFixed(1)} cm`,
            ];
            const uniqueDistractors = [...new Set(distractors)].filter(d => d !== correctVal);

            return {
               type: "physics_optics",
               prompt: `A spherical concave mirror has a radius of curvature of ${radius} cm. What is its focal length?`,
               choices: seededShuffle([correctVal, ...uniqueDistractors].slice(0, 4), rng),
               answer: correctVal,
               explanation: `The focal length of a spherical mirror is half its radius of curvature (f = R/2). So, ${radius} cm / 2 = ${correctVal}.`,
            };
         }
      }

      if (subType === 3) {
         // Ohm's Law: V = I * R
         const current = Math.floor(rng() * 5) + 2; // 2 to 6 A
         const resistance = Math.floor(rng() * 10) + 2; // 2 to 11 ohms
         const voltage = current * resistance;

         const correctVal = `${voltage} V`;
         const distractors = [
            `${voltage} A`,
            `${voltage} Ω`,
            `${current} V`,
            `${resistance} V`,
            `${(voltage * 1.5).toFixed(0)} V`,
         ];

         const uniqueDistractors = [...new Set(distractors)].filter(d => d !== correctVal);

         return {
            type: "physics_electricity",
            prompt: `A current of ${current} A flows through a resistor with a resistance of ${resistance} Ω. What is the electrical potential difference (voltage) across the resistor?`,
            choices: seededShuffle([correctVal, ...uniqueDistractors].slice(0, 4), rng),
            answer: correctVal,
            explanation: `Voltage = Current × Resistance. So, ${current} A × ${resistance} Ω = ${correctVal}.`,
         };
      }

      if (subType === 4) {
         // Density: d = m / V
         const volume = Math.floor(rng() * 8) + 3; // 3 to 10 cm3
         const densityVal = Math.floor(rng() * 6) + 2; // 2 to 7 g/cm3
         const mass = volume * densityVal;

         const correctVal = `${densityVal} g/cm³`;
         const distractors = [
            `${densityVal} g`,
            `${densityVal} cm³`,
            `${mass} g/cm³`,
            `${(densityVal * 1.5).toFixed(1)} g/cm³`,
            `${(densityVal / 2).toFixed(1)} g/cm³`,
         ];

         const uniqueDistractors = [...new Set(distractors)].filter(d => d !== correctVal);

         return {
            type: "physics_density",
            prompt: `A solid block has a mass of ${mass} grams and a volume of ${volume} cm³. What is its density?`,
            choices: seededShuffle([correctVal, ...uniqueDistractors].slice(0, 4), rng),
            answer: correctVal,
            explanation: `Density = Mass / Volume. So, ${mass} g / ${volume} cm³ = ${correctVal}.`,
         };
      }

      // Work: W = F * d
      const force = Math.floor(rng() * 20) + 5; // 5 to 24 N
      const distance = Math.floor(rng() * 8) + 2; // 2 to 9 m
      const workVal = force * distance;

      const correctVal = `${workVal} J`;
      const distractors = [
         `${workVal} N`,
         `${workVal} W`,
         `${workVal} m`,
         `${(workVal * 2).toFixed(0)} J`,
         `${(workVal / 2).toFixed(0)} J`,
      ];

      const uniqueDistractors = [...new Set(distractors)].filter(d => d !== correctVal);

      return {
         type: "physics_work",
         prompt: `How much work is done when a constant force of ${force} N moves a box a distance of ${distance} meters along a flat surface?`,
         choices: seededShuffle([correctVal, ...uniqueDistractors].slice(0, 4), rng),
         answer: correctVal,
         explanation: `Work = Force × Distance. So, ${force} N × ${distance} m = ${correctVal}.`,
      };
   }

   return null;
}
