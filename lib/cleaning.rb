module Cleaning
  extend ActiveSupport::Concern

  included do
    before_save :clean_unneeded_whitespace
  end

  def clean_unneeded_whitespace
    self.attribute_names.each do |attr|
      value = self.send(attr)
      if value.class == String
        self.send(attr.to_s + '=', value.blank? ? nil : value.strip)
      end
    end
  end
end
