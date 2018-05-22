module Cleaning
  extend ActiveSupport::Concern

  included do
    before_save :nullify_blank_strings
  end

  def nullify_blank_strings
    self.attribute_names.each do |attr|
      self.send(attr.to_s + '=', nil) if self.send(attr).blank?
    end
  end
end
