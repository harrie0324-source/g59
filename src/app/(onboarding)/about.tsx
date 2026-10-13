import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Step } from '@/features/onboarding/Step';
import { parseAbout } from '@/services/onboarding';
import { useOnboarding } from '@/stores/onboarding';
import { Button, Field, Segmented, Text, ToggleRow, space } from '@/ui';
import { localDate } from '@/lib/format';

export default function About() {
  const { draft, update } = useOnboarding();
  const [submitted, setSubmitted] = useState(false);
  const result = parseAbout(draft, localDate());
  const errors = submitted && !result.ok ? result.errors : {};
  const us = draft.units === 'us';

  return (
    <Step
      step={1}
      title="About you"
      subtitle="Used for your starting estimate. You can change these later."
      footer={
        <Button
          title="Continue"
          onPress={() => {
            setSubmitted(true);
            if (result.ok) router.push('/activity');
          }}
        />
      }>
      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="secondary">
          Units
        </Text>
        <Segmented
          label="Units"
          value={draft.units}
          onChange={(units) => update({ units })}
          options={[
            { value: 'us', label: 'lb · ft/in' },
            { value: 'metric', label: 'kg · cm' },
          ]}
        />
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="secondary">
          Sex used for the calorie formula
        </Text>
        <Segmented
          label="Sex used for the calorie formula"
          value={draft.formulaSex}
          onChange={(formulaSex) => update({ formulaSex })}
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'average', label: 'Average of both' },
          ]}
        />
        <Text variant="caption" tone="secondary">
          The standard formula has a male and a female version. "Average of both" uses the midpoint.
        </Text>
        {errors.formulaSex ? <Text variant="caption">{errors.formulaSex}</Text> : null}
      </View>

      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Field flex={1} label="Birth month" placeholder="MM" keyboardType="number-pad" maxLength={2} value={draft.dobMonth} onChangeText={(dobMonth) => update({ dobMonth })} />
          <Field flex={1} label="Day" placeholder="DD" keyboardType="number-pad" maxLength={2} value={draft.dobDay} onChangeText={(dobDay) => update({ dobDay })} />
          <Field flex={1.4} label="Year" placeholder="YYYY" keyboardType="number-pad" maxLength={4} value={draft.dobYear} onChangeText={(dobYear) => update({ dobYear })} />
        </View>
        {errors.dob ? <Text variant="caption">{errors.dob}</Text> : null}
      </View>

      {us ? (
        <View style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Field flex={1} label="Height" unit="ft" keyboardType="number-pad" maxLength={1} value={draft.heightFt} onChangeText={(heightFt) => update({ heightFt })} />
            <Field flex={1} label=" " accessibilityLabel="Height, inches" unit="in" keyboardType="number-pad" maxLength={2} value={draft.heightIn} onChangeText={(heightIn) => update({ heightIn })} />
          </View>
          {errors.height ? <Text variant="caption">{errors.height}</Text> : null}
        </View>
      ) : (
        <Field label="Height" unit="cm" keyboardType="number-pad" maxLength={3} value={draft.heightCm} onChangeText={(heightCm) => update({ heightCm })} error={errors.height} />
      )}

      <Field
        label="Current weight"
        unit={us ? 'lb' : 'kg'}
        keyboardType="decimal-pad"
        maxLength={5}
        value={draft.weight}
        onChangeText={(weight) => update({ weight })}
        error={errors.weight}
      />

      <View style={{ gap: space.sm }}>
        <ToggleRow
          label="Pregnant or breastfeeding"
          description="Burnrate won't set a calorie deficit. Please talk with your doctor about what's right for you."
          value={draft.pregnancyStatus !== 'none'}
          onValueChange={(on) => update({ pregnancyStatus: on ? 'pregnant' : 'none' })}
        />
        {draft.pregnancyStatus !== 'none' ? (
          <Segmented
            label="Which applies"
            value={draft.pregnancyStatus}
            onChange={(pregnancyStatus) => update({ pregnancyStatus })}
            options={[
              { value: 'pregnant', label: 'Pregnant' },
              { value: 'breastfeeding', label: 'Breastfeeding' },
            ]}
          />
        ) : null}
      </View>
    </Step>
  );
}
